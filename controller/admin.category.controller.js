const catagorymodel = require("../model/catagorymodel");
const productmodel = require("../model/productmodel");

// "spicy blends"  -> "Spicy blends"
// "SPICY BLENDS"  -> "Spicy blends"
function capitalizeFirst(str) {
  const trimmed = str.trim().toLowerCase();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const loadaddcatagory = (req, res) => {
  res.render("admin/addcatagory");
};

const addingcatagory = async (req, res) => {
  try {

    const { name, description} = req.body;
    const normalizedName = capitalizeFirst(name);

    const existing_catagory = await catagorymodel.findOne({ name: normalizedName });

    if (existing_catagory) {

      const catagory = await catagorymodel.find();

      return res.render("admin/addcatagory", {
        catagory,
        error: "Category already exists"
      });
    }

    const image = req.file ? req.file.filename : null;

    const new_catagory = new catagorymodel({
      name: normalizedName,
      description,
      image
    });

    await new_catagory.save();

    res.redirect("/admin/catagory");

  } catch (error) {
    console.log(error);
  }
};

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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await catagorymodel.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCategories / limit);

    // count products for each category
    const categoryWithCount = await Promise.all(
      catagory.map(async (cat) => {
        const productCount = await productmodel.countDocuments({ catagory: cat._id });
        return { ...cat.toObject(), productCount };
      })
    );

    res.render("admin/catagory", {
      catagory: categoryWithCount,
      search,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/category");
  }
};

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
    const normalizedName = capitalizeFirst(name);

    // optional: check duplicate name
    const existing = await catagorymodel.findOne({
      name: normalizedName,
      _id: { $ne: id }
    });

    if (existing) {
      return res.render('admin/editcatagory', {
        catagory: { _id: id, name: normalizedName, description },
        error: 'Category already exists'
      });
    }

    const updateData = {
      name: normalizedName,
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

module.exports = {
  loadaddcatagory,
  addingcatagory,
  loadcatagory,
  blockcatagory,
  unblockcatagory,
  loadEditCatagory,
  updateCategory,
};