 const express=require("express")
 const user=require("../controller/usercontroller")
 const userauth=require("../middleware/userAuth")
 const route=express.Router()
 const passport = require("passport");
 const upload=require("../config/multer")
const usermodel=require("../model/usermodel")
const checkstatus=require("../middleware/userstatus")

// User auth & profile
route.get("/",userauth.isLogin,user.loadladingpage)
 route.get("/signup",userauth.isLogout,user.loadsignup)
 route.post("/signup",userauth.isLogout,user.registeruser)
 route.get("/otpverification",userauth.isLogin,user.loadverify)
 route.post("/otpverification",userauth.isLogin,user.veriify)
 route.post("/resend-otp", user.resendOtp);
 route.get("/login",userauth.isLogout,user.loadlogin)
 route.post("/login",userauth.isLogout,user.loginuser)
 route.get("/home",checkstatus,userauth.isLogin,user.loadhome)
 route.get("/forgotpassword",userauth.isLogout,user.loadforgotpassword)
 route.post("/forgotpassword",userauth.isLogin,user.forgotpassword)
 route.get("/resetpassword",userauth.isLogin,user.loadresetpassword)
 route.post("/resetpassword",userauth.isLogin,user.resetPassword)
 route.get("/successpassword",userauth.isLogin,user.loadsuccess)
 route.get("/profile",checkstatus,user.loadprofile)
 route.get("/editprofile",checkstatus,userauth.isLogin,user.loadeditprofile)
 route.post("/editprofile",userauth.isLogin,upload.single("profileImage"),user.updateprofile)
 route.get("/changepassword",checkstatus,userauth.isLogin,user.loadchangepassword)
 route.post("/changepassword",userauth.isLogin,user.changepassword) 
 route.get("/address",checkstatus,userauth.isLogin,user.loadaddress)
 route.get("/addaddress",checkstatus,user.loadaddaddress)
 route.post("/addaddress",user.addaddress)
 route.get("/editaddress/:id",checkstatus,user.loadEditAddress)
 route.post("/editaddress/:id",user.updateAddress)
route.post("/deleteaddress/:id", user.deleteAddress);
// Start Google Login
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




route.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});
route.post("/delete-profile-image", async (req, res) => {
  try {
    const userId = req.session.userId;

    await userModel.findByIdAndUpdate(userId, {
      profileImage: null
    });

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});




 module.exports=route