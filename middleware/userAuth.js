const isLogin = (req, res, next) => {
  if (req.session.userId) {
    return next();   // user logged in - allow access
  } else {
    return res.redirect("/login");  // not logged in - go to login
  }
};

const isLogout = (req, res, next) => {
  if (req.session.userId) {
    return res.redirect("/home");  // already logged in - block login page
  } else {
    return next();   // not logged in - allow login page
  }
};

module.exports = { isLogin, isLogout };