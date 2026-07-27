const catagorymodel = require("../model/catagorymodel");
const productmodel = require("../model/productmodel");
const { productSchema, variantSchema } = require("../validators/productvalidator");

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
    const { name, description } = req.body;
    const categories = await catagorymodel.find({ status: "Active" });

    // handle images
    const images = req.files && req.files.length > 0
      ? req.files.map(file => file.filename)
      : [];

    // VARIANTS PARSE
    let variants = [];

    if (req.body.variants) {
      if (Array.isArray(req.body.variants)) {
        variants = req.body.variants;
      } else {
        variants = Object.values(req.body.variants);
      }

      variants = variants.map(v => ({
        name: v.name,
        price: Number(v.price),
        stock: Number(v.stock)
      }));
    }

    const parsed = productSchema.safeParse({
      name: req.body.name,
      description: req.body.description,
      catagory: req.body.catagory,
      variants
    });

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0].message;

      return res.render("admin/addproduct", {
        error: errorMessage,
        catagory: categories
      });
    }

    if (images.length < 3) {
      return res.render("admin/addproduct", {
        error: "Please upload at least 3 image",
        catagory: categories
      });
    }

    // CATEGORY CHECK
    const categoryExists = await catagorymodel.findById(parsed.data.catagory);

    if (!categoryExists) {
      return res.render("admin/addproduct", {
        error: "Invalid category",
        catagory: categories
      });
    }

    // CREATE PRODUCT
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

    const limit = 5;
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
      .sort({ createdAt: -1 })
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

const loadeditproduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Get product with category
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

    // 1. Handle Variants
    let variants = [];

    if (req.body.variants) {
      variants = Object.values(req.body.variants).map(v => ({
        name: v.name,
        price: Number(v.price),
        stock: Number(v.stock)
      }));
    }

    // 2. Handle Images
    // images user kept
    let existingImages = req.body.existingImages || [];

    if (!Array.isArray(existingImages)) {
      existingImages = [existingImages];
    }
    // new uploaded images
    const newImages = req.files?.map(file => file.filename) || [];

    // final images
    const finalImages = [...existingImages, ...newImages];

    // 3. Update product
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

const blockproduct = async (req, res) => {
  try {
    const id = req.params.id;
    await productmodel.findByIdAndUpdate(id, { status: "Blocked" });
    res.redirect("/admin/product?success=blocked");
  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
};

const unblockproduct = async (req, res) => {
  try {
    const id = req.params.id;
    await productmodel.findByIdAndUpdate(id, { status: "Active" });
    res.redirect("/admin/product?success=unblocked");
  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  loadaddproduct,
  addProduct,
  loadproduct,
  loadeditproduct,
  editproduct,
  blockproduct,
  unblockproduct,
};