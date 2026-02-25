const userModel = require("../model/usermodel");

const checkUserStatus = async (req, res, next) => {
  try {
    // If not logged in
    if (!req.session.userId) {
      return res.redirect("/login");
    }

    const user = await userModel.findById(req.session.userId);

    // If user not found
    if (!user) {
      req.session.destroy();
      return res.redirect("/login");
    }

    // If blocked
    if (user.status === "Blocked") {
      req.session.destroy();
      return res.redirect("/login");
    }

    // Attach user to request (optional but useful)
    req.user = user;

    next();

  } catch (error) {
    console.log("User Status Middleware Error:", error);
    res.redirect("/login");
  }
};

module.exports = checkUserStatus;