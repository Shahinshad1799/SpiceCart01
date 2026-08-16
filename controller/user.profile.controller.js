const usermodel = require("../model/usermodel");
const { editProfileSchema } = require("../validators/uservalidator");
const { sendotp } = require("./user.auth.controller");
const orderModel = require("../model/ordermodel");

// =======================
// User Profile
// =======================
const loadprofile = async (req, res) => {
  try {
    const userId = req.user?._id || req.session.userId;
    if (!userId) return res.redirect("/login");
    const favoriteCCategory = await orderModel.aggregate([
      { $match: { userId: userId } },
      { $unwind: "$items" },
      { $group: { _id: "$items.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    res.locals.favoriteCategory = favoriteCCategory[0]?._id || "N/A";
    const user = await usermodel.findById(userId);
    res.render("user/profile", { user, currentPage: 'profile' });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

const loadeditprofile = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const user = await usermodel.findById(userId);
    res.render("user/editprofile", { user, error: {} });
  } catch (error) {
    console.log(error);
    res.redirect("/profile");
  }
};

const updateprofile = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("is patch working");
    // Validate using Zod
    const result = editProfileSchema.safeParse(req.body);

    if (!result.success) {
      const errorMessage = result.error.issues[0].message;

      return res.render("user/editprofile", {
        user: req.body,
        error: errorMessage,
      });
    }

    const { fullname, phonenumber, dateofbirth } = result.data;

    let updateData = { fullname, phonenumber, dateofbirth };

    if (req.file) {
      updateData.profileImage = req.file.filename;
    }

    await usermodel.updateOne(
      { _id: userId },
      { $set: updateData }
    );

    res.redirect("/profile");

  } catch (error) {
    console.log("FULL ERROR:", error);
    res.render("user/editprofile", {
      error: error.message || "Something went wrong",
    });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const userId = req.session.userId;

    await usermodel.findByIdAndUpdate(userId, {
      profileImage: null
    });

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
};

// =======================
// Email change
// =======================
const loadchangeemail = (req, res) => {
  res.render("user/changeemail");
};

const changeemail = async (req, res) => {
  try {
    const { email } = req.body;
    req.session.newEmail = email;

    const users = await usermodel.findOne({ email });
    if (users) return res.render("user/forgotpasword", { error: "Email already registered" });

    const otpExpiry = await sendotp(email);

    res.render("user/otpverification", { purpose: "changeemail", otpExpiry });
  } catch (error) {
    console.log(error);
    return res.render("user/forgotpasword", { error: "Something went wrong" });
  }
};

module.exports = {
  loadprofile,
  loadeditprofile,
  updateprofile,
  deleteProfile,
  loadchangeemail,
  changeemail,
};