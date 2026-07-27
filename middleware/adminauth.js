const requireAdminLogin = (req, res, next) => {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.redirect("/admin/login");
  }
};

const redirectIfAdminLoggedIn = (req, res, next) => {
  if (req.session && req.session.admin) {
    res.redirect("/admin/dashboard");
  } else {
    next();
  }
};

module.exports = { requireAdminLogin, redirectIfAdminLoggedIn };