
const usermodel = require("../model/usermodel")
const bcrypt = require("bcrypt"); // only if you hash password
require("dotenv").config();
const catagorymodel=require("../model/catagorymodel")
const productmodel=require("../model/productmodel")
const { productSchema } = require("../validators/productvalidator");

const loadadminlogin=function(req,res){
    res.render("admin/login")
}
// ================= LOAD PAGE =================
const loadaddproduct = async (req, res) => {
  try {
    const categories = await catagorymodel.find({ status: "Active" });

    res.render("admin/addproduct", {
      catagory: categories 
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin");
  }
};


// ADD PRODUCT
const addProduct = async (req, res) => {
  try {
    const categories = await catagorymodel.find({ status: "Active" });

    // ✅ handle images
    const images = req.files && req.files.length > 0
      ? req.files.map(file => file.filename)
      : [];

    //VARIANTS PARSE 
    let variants = [];

    if (req.body.variants) {
      if (Array.isArray(req.body.variants)) {
        variants = req.body.variants;
      } else {
        variants = Object.values(req.body.variants);
      }

      variants = variants.map(v => ({
        name: v.name,
        price: v.price,
        stock: v.stock
      }));
    }

    // ZOD VALIDATION 
    const parsed = productSchema.safeParse({
      name: req.body.name,
      description: req.body.description,
      catagory: req.body.catagory,
      variants
    });

    if (!parsed.success) {
      const errorMessage = parsed.error.errors[0].message;

      return res.render("admin/addproduct", {
        error: errorMessage,
        catagory: categories
      });
    }

    // IMAGE VALIDATION 
    if (images.length < 3) {
      return res.render("admin/addproduct", {
        error: "Please upload at least 3 image",
        catagory: categories
      });
    }

    //  CATEGORY CHECK 
    const categoryExists = await catagorymodel.findById(parsed.data.catagory);

    if (!categoryExists) {
      return res.render("admin/addproduct", {
        error: "Invalid category",
        catagory: categories
      });
    }

    //  CREATE PRODUCT
    const newProduct = new productmodel({
      ...parsed.data,
      images
    });

    await newProduct.save();

    res.redirect("/admin/product");

  } catch (error) {
    console.log("ERROR:", error.message);

    const categories = await catagorymodel.find({ status: "Active" });

    res.render("admin/addproduct", {
      error: "Something went wrong",
      catagory: categories
    });
  }
};
const loadproduct = async (req, res) => {
  try {
    const search = req.query.q || "";
    const catagory = req.query.catagory || ""; 
    const page = parseInt(req.query.page) || 1;

    const limit = 3;
    const skip = (page - 1) * limit;

    let searchQuery = {
      name: { $regex: search, $options: "i" }
    };

    if (catagory) {
      searchQuery.catagory = catagory;
    }

    const products = await productmodel
      .find(searchQuery)
      .populate("catagory") 
      .skip(skip)
      .limit(limit);

    const totalProducts = await productmodel.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await catagorymodel.find({ status: "Active" });

    res.render("admin/product", {
      catagory: categories,
      product: products,
      search,
      selectedCatagory: catagory, 
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin");
  }
};
const loadaddcatagory=(req,res)=>{
  res.render("admin/addcatagory")
}



const addingcatagory = async (req, res) => {
  try {

    const { name, description } = req.body;

    const existing_catagory = await catagorymodel.findOne({ name });

    if (existing_catagory) {

      const catagory = await catagorymodel.find();

      return res.render("admin/addcatagory", {
        catagory,
        error: "Category already exists"
      });
    }

    const image = req.file ? req.file.filename : null;

    const new_catagory = new catagorymodel({
      name,
      description,
      image
    });

    await new_catagory.save();

    res.redirect("/admin/catagory");

  } catch (error) {
    console.log(error);
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      
      req.session.loginError = "Invalid email or password"; 
      return res.redirect("/admin/login");
    }

    // Set session
    req.session.admin = "admin"; 

    // Redirect to admin dashboard
    return res.redirect("/admin/customer");

  } catch (error) {
    console.log("Admin Login Error:", error);
    req.session.loginError = "Server error, try again!";
    return res.redirect("/admin/login");
  }
};

const loaddashboard=function(req,res){
    res.render("admin/dashboard")
}
const loadcatagory = async (req, res) => {
  try {

    const search = req.query.q || "";
    const page = parseInt(req.query.page) || 1;

    const limit = 3;
    const skip = (page - 1) * limit;

    const searchQuery = {
      name: { $regex: search, $options: "i" }
    };

    const catagory = await catagorymodel
      .find(searchQuery)
      .skip(skip)
      .limit(limit);

    const totalCategories = await catagorymodel.countDocuments(searchQuery);

    const totalPages = Math.ceil(totalCategories / limit);

    res.render("admin/catagory", {
      catagory,
      search,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/category");
  }
};
const loadcustomer = async (req, res) => {
  try {
    const search = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    // Search filter
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { customerId: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const totalCustomers = await usermodel.countDocuments(filter);
    const totalPages = Math.ceil(totalCustomers / limit);

    // filter here
    const customers = await usermodel
      .find(filter)
      .sort({ googleId: -1 ,name:1})
      .skip(skip)
      .limit(limit);

    res.render("admin/customer", {
      customers,
      search,
      currentPage: page,
      totalPages,
    });

  } catch (error) {
    console.log("Customer Load Error:", error);
    res.status(500).send("Server Error");
  }
};
const blockcustomer= async (req, res) => {
  try {
    const id = req.params.id;
    await usermodel.findByIdAndUpdate(id, { status: "Blocked" });
    res.redirect("/admin/customer");
  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
}
const unblockcustomer= async (req, res) => {
  try {
    const id = req.params.id;
    await usermodel.findByIdAndUpdate(id, { status: "Active" });
    res.redirect("/admin/customer");
  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
}
const blockcatagory = async (req, res) => {
  try {
    const id = req.params.id;
    const page = req.query.page || 1; 

    await catagorymodel.findByIdAndUpdate(id, { status: "Blocked" });

    res.redirect(`/admin/catagory?page=${page}`); 

  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
};

const unblockcatagory = async (req, res) => {
  try {
    const id = req.params.id;
    const page = req.query.page || 1; 

    await catagorymodel.findByIdAndUpdate(id, { status: "Active" });

    res.redirect(`/admin/catagory?page=${page}`); 

  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
};
const logout=function(req, res){
  req.session.destroy(() => {
    res.redirect("/login");
  });
}
const blockproduct= async (req, res) => {
  try {
    const id = req.params.id;
    await productmodel.findByIdAndUpdate(id, { status: "Blocked" });
    res.redirect("/admin/product");
  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
}
const unblockproduct= async (req, res) => {
  try {
    const id = req.params.id;
    await productmodel.findByIdAndUpdate(id, { status: "Active" });
    res.redirect("/admin/product");
  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
}

const loadEditCatagory = async (req, res) => {
  try {
    const id = req.params.id;

    const catagory = await catagorymodel.findById(id);

    if (!catagory) {
      return res.redirect('/admin/catagory');
    }

    res.render('admin/editcatagory', {
      catagory
    });

  } catch (error) {
    console.log(error);
    res.redirect('/admin/catagory');
  }
};
const updateCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;

    // optional: check duplicate name
    const existing = await catagorymodel.findOne({
      name: name.trim(),
      _id: { $ne: id }
    });

    if (existing) {
      return res.render('admin/editcatagory', {
        catagory: { _id: id, name, description },
        error: 'Category already exists'
      });
    }

    const updateData = {
      name: name.trim(),
      description: description.trim()
    };

    // if image uploaded
    if (req.file) {
      updateData.image = req.file.filename;
    }

    await catagorymodel.findByIdAndUpdate(id, updateData);

    res.redirect('/admin/catagory');

  } catch (error) {
    console.log(error);
    res.redirect('/admin/catagory');
  }
};
const loadeditproduct = async (req, res) => {
  try {
    const productId = req.params.id;

    //  Get product with category
    const product = await productmodel
      .findById(productId)
      .populate("catagory");

    // Get all categories
    const categories = await catagorymodel.find({ status: "Active" });

    // If product not found
    if (!product) {
      return res.redirect("/admin/product");
    }

    res.render("admin/editproduct", {
      product,
        variants: product?.variants || [],
      catagory: categories
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/product");
  }
};


const editproduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const { name, description, catagory } = req.body;

    //  1. Handle Variants
    let variants = [];

    if (req.body.variants) {
      variants = Object.values(req.body.variants).map(v => ({
        name: v.name,
        price: Number(v.price),
        stock: Number(v.stock)
      }));
    }

    //  2. Handle Images
    // images user kept
let existingImages = req.body.existingImages || [];

if (!Array.isArray(existingImages)) {
  existingImages = [existingImages];
}
    // new uploaded images
    const newImages = req.files?.map(file => file.filename) || [];

    // final images
    const finalImages = [...existingImages, ...newImages];

    //  3. Update product
    await productmodel.findByIdAndUpdate(productId, {
      name,
      description,
      catagory,
      variants,
      images: finalImages
    });
  console.log("FILES:", req.files);
    res.redirect("/admin/product");

  } catch (error) {
    console.log(error);
    res.status(500).send("Error updating product");
  }
};



module.exports={
    loadadminlogin,
    loaddashboard,
    loadcustomer,
    adminLogin,
    blockcustomer,
    unblockcustomer,
    blockcatagory,
    unblockcatagory,
    loadaddproduct,
    loadproduct,
    loadcatagory,
    loadaddcatagory,
    addingcatagory,
    loadEditCatagory,
    updateCategory,
    addProduct,
    loadeditproduct,
    editproduct,
    blockproduct,
    unblockproduct,
    logout
}