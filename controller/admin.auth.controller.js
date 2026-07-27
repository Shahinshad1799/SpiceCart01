require("dotenv").config();

const loadadminlogin = function (req, res) {
  res.render("admin/login");
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
    return res.redirect("/admin/dashboard");

  } catch (error) {
    console.log("Admin Login Error:", error);
    req.session.loginError = "Server error, try again!";
    return res.redirect("/admin/login");
  }
};

const logout = function (req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.log("Logout error:", err);
    }
    res.redirect("/admin/login");
  });
};

module.exports = {
  loadadminlogin,
  adminLogin,
  logout,
};