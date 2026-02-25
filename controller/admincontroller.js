
const usermodel = require("../model/usermodel")
const bcrypt = require("bcrypt"); // only if you hash password
require("dotenv").config();

const loadadminlogin=function(req,res){
    res.render("admin/login")
}


const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Compare with ENV values
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      // Redirect back to login with an error message
      req.session.loginError = "Invalid email or password"; // optional for showing message in EJS
      return res.redirect("/admin/login");
    }

    // Set session
    req.session.admin = "admin"; // simple identifier for session

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

    // 🔥 Use filter here
    const customers = await usermodel
      .find(filter)
      .sort({ name: 1 })
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
const logout=function(req, res){
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

module.exports={
    loadadminlogin,
    loaddashboard,
    loadcustomer,
    adminLogin,
    blockcustomer,
    unblockcustomer,
    logout
}