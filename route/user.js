 const express=require("express")
 const user=require("../controller/usercontroller")
 const userauth=require("../middleware/userAuth")
 const route=express.Router()
 const passport = require("passport");
 const upload=require("../config/multer")
const usermodel=require("../model/usermodel")
const checkstatus=require("../middleware/userstatus")

// User auth & profile
// route.get("/",user.loadladingpage)
//  route.get("/signup",userauth.isLogout,user.loadsignup)
//  route.post("/signup",userauth.isLogout,user.registeruser)
//  route.get("/otpverification",user.loadverify)
//  route.post("/otpverification",user.veriify)
//  route.post("/resendotp", user.resendOtp);
//  route.get("/login",userauth.isLogout,user.loadlogin)
//  route.post("/login",user.loginuser)
//  route.get("/home",userauth.isLogin,checkstatus,user.loadhome)
//  route.get("/forgotpassword",userauth.isLogout,user.loadforgotpassword)
//  route.post("/forgotpassword",userauth.isLogin,user.forgotpassword)
//  route.get("/resetpassword",userauth.isLogin,user.loadresetpassword)
//  route.post("/resetpassword",userauth.isLogin,user.resetPassword)
//  route.get("/successpassword",userauth.isLogin,user.loadsuccess)
//  route.get("/profile",checkstatus,user.loadprofile)
//  route.get("/editprofile",checkstatus,userauth.isLogin,user.loadeditprofile)
//  route.post("/editprofile",userauth.isLogin,upload.single("profileImage"),user.updateprofile)
//  route.get("/changepassword",checkstatus,userauth.isLogin,user.loadchangepassword)
//  route.post("/changepassword",userauth.isLogin,user.changepassword) 
//  route.get("/address",checkstatus,userauth.isLogin,user.loadaddress)
//  route.get("/addaddress",checkstatus,user.loadaddaddress)
//  route.post("/addaddress",user.addaddress)
//  route.get("/editaddress/:id",checkstatus,user.loadEditAddress)
//  route.post("/editaddress/:id",user.updateAddress)
// route.post("/deleteaddress/:id", user.deleteAddress);
// route.post("/logout",user.logout);
// route.post("/delete-profile-image",user.deleteProfile);
// // Start Google Login
route.get("/", user.loadladingpage);

route.get("/signup", userauth.isLogout, user.loadsignup);
route.post("/signup", userauth.isLogout, user.registeruser);

route.get("/otpverification", user.loadverify);
route.post("/otpverification", user.veriify);
route.post("/resendotp", user.resendOtp);

route.get("/login", userauth.isLogout, user.loadlogin);
route.post("/login", userauth.isLogout, user.loginuser);

route.get("/home", userauth.isLogin, checkstatus, user.loadhome);

route.get("/forgotpassword", userauth.isLogout, user.loadforgotpassword);
route.post("/forgotpassword", userauth.isLogout, user.forgotpassword);

route.get("/resetpassword", userauth.isLogout, user.loadresetpassword);
route.post("/resetpassword", userauth.isLogout, user.resetPassword);

route.get("/successpassword", userauth.isLogout, user.loadsuccess);

route.get("/profile", userauth.isLogin, checkstatus, user.loadprofile);
route.get("/editprofile", userauth.isLogin, checkstatus, user.loadeditprofile);
route.post("/editprofile", userauth.isLogin, upload.single("profileImage"), user.updateprofile);

route.get("/changepassword", userauth.isLogin, checkstatus, user.loadchangepassword);
route.post("/changepassword", userauth.isLogin, user.changepassword);

route.get("/address", userauth.isLogin, checkstatus, user.loadaddress);
route.get("/addaddress", userauth.isLogin, checkstatus, user.loadaddaddress);
route.post("/addaddress", userauth.isLogin, user.addaddress);

route.get("/editaddress/:id", userauth.isLogin, checkstatus, user.loadEditAddress);
route.post("/editaddress/:id", userauth.isLogin, user.updateAddress);
route.post("/deleteaddress/:id", userauth.isLogin, user.deleteAddress);

route.post("/logout", userauth.isLogin, user.logout);
route.post("/delete-profile-image", userauth.isLogin, user.deleteProfile);
route.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback
route.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {

    req.session.userId = req.user._id; 

    res.redirect("/home");
  }
);






 module.exports=route