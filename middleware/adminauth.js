// Protect routes for admins only
const requireAdminLogin = (req, res, next) => {
//   if (req.session && req.session.admin) {
//     // Admin is logged in → allow access
//     next();
//   } else {
//     // Admin not logged in → redirect to login page
//     res.redirect("/admin/login");
//   }
next()
};

// Redirect logged-in admin away from login page
const redirectIfAdminLoggedIn = (req, res, next) => {
//   if (req.session && req.session.admin) {
//     // Already logged in → go to customer page
//     res.redirect("/admin/customer");
//   } else {
//     // Not logged in → show login page
//     next();
//   }
next()
};

module.exports = { requireAdminLogin, redirectIfAdminLoggedIn };
