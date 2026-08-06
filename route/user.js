// 

const express = require("express")
const route = express.Router()

// Split controllers
const authController      = require("../controller/user.auth.controller")
const profileController   = require("../controller/user.profile.controller")
const addressController   = require("../controller/user.address.controller")
const shopController      = require("../controller/user.shop.controller")
const wishlistController  = require("../controller/user.wishlist.controller")
const checkoutController  = require("../controller/user.checkout.controller")
const orderController     = require("../controller/user.order.controller")
const walletController    = require("../controller/user.wallet.controller")
const referralController  = require("../controller/user.referral.controller")

const cartController = require("../controller/cartcontroller")
const userauth = require("../middleware/userAuth")
const upload = require("../config/multer")
const checkstatus = require("../middleware/userstatus")

route.get("/", authController.loadladingpage);

route.get("/signup", userauth.isLogout, authController.loadsignup);
route.post("/signup", userauth.isLogout, authController.registeruser);

route.get("/otpverification", authController.loadverify);
route.post("/otpverification", authController.veriify);
route.post("/resendotp", authController.resendOtp);

route.get("/login", userauth.isLogout, authController.loadlogin);
route.post("/login", userauth.isLogout, authController.loginuser);

route.get("/home", userauth.isLogin, checkstatus, authController.loadhome);

route.get("/forgotpassword", userauth.isLogout, authController.loadforgotpassword);
route.post("/forgotpassword", userauth.isLogout, authController.forgotpassword);

route.get("/resetpassword", userauth.isLogout, authController.loadresetpassword);
route.post("/resetpassword", userauth.isLogout, authController.resetPassword);

route.get("/successpassword", userauth.isLogout, authController.loadsuccess);

route.get("/profile", userauth.isLogin, checkstatus, profileController.loadprofile);
route.get("/editprofile", userauth.isLogin, checkstatus, profileController.loadeditprofile);
route.patch("/editprofile", userauth.isLogin, upload.single("profileImage"), profileController.updateprofile);


route.get("/changepassword", userauth.isLogin, checkstatus, authController.loadchangepassword);
route.post("/changepassword", userauth.isLogin, authController.changepassword);

route.get("/address", userauth.isLogin, checkstatus, addressController.loadaddress);
route.get("/addaddress", userauth.isLogin, checkstatus, addressController.loadaddaddress);
route.post("/addaddress", userauth.isLogin, addressController.addaddress);

route.get("/editaddress/:id", userauth.isLogin, checkstatus, addressController.loadEditAddress);
route.post("/editaddress/:id", userauth.isLogin, addressController.updateAddress);
route.post("/deleteaddress/:id", userauth.isLogin, addressController.deleteAddress);

route.post("/logout", userauth.isLogin, authController.logout);
route.post("/delete-profile-image", userauth.isLogin, profileController.deleteProfile);

route.get("/changeemail", profileController.loadchangeemail)
route.post("/changeemail", profileController.changeemail)

route.get("/shop", shopController.loadshop)

route.get("/productdetails/:id", shopController.loaddetails)

route.get("/cart", cartController.getCartPage);

route.post("/cart/add", cartController.addToCart);
route.post("/cart/update", cartController.updateCart);
route.post("/cart/remove", cartController.removeFromCart);
route.post("/cart/apply-coupon", cartController.applyCoupon);
route.post("/cart/remove-coupon", cartController.removeCoupon);

route.get('/wishlist', wishlistController.loadWishlist);
route.post('/wishlist/toggle', wishlistController.toggleWishlist);

route.get("/checkout", checkoutController.loadcheckout)
route.post("/address/add", addressController.addAddress);
route.put("/address/edit/:addressId", addressController.editAddress);

route.get("/ordersuccess", orderController.loadordersuccess)
route.post("/place-order", orderController.placeorder)
route.post('/create-order', orderController.onlineorder)
route.post('/verify-payment', orderController.verifyOnlineOrder)

route.post('/place-order-wallet', orderController.placeOrderWallet);

route.post("/orders/:id/retry-payment", orderController.retryPayment);
route.post("/orders/:id/verify-retry-payment", orderController.verifyRetryPayment);
route.get("/order", orderController.loadorder)
route.get("/orders/:id", orderController.loadorderdetails)
route.patch("/orders/:id/cancel", orderController.cancelOrder)
route.patch('/orders/:id/cancel-item', orderController.cancelOrderItem);
route.patch("/orders/:id/return", orderController.returnorder);

route.get("/wallet", walletController.loadWallet)
route.get("/referrals", userauth.isLogin,referralController.loadreferrals)
route.get("/r/:code", referralController.referralLanding);

route.get("/auth/google", authController.googleAuth);
route.get("/auth/google/callback", authController.googleCallback);

module.exports = route