// const express=require("express")
// const admin=require("../controller/admincontroller")
// const offerController = require("../controller/admin_offerroute");
// const adminroute=express.Router()
// const usermodel=require("../model/usermodel")
// const Offer=require("../model/offermodel")
// const adminauth=require("../middleware/adminauth")
//  const uploadcatagory=require("../config/catagorymulter")
//  const uploadproduct=require("../config/productmulter")
// // Login routes (no auth needed)
// adminroute.get("/login", adminauth.redirectIfAdminLoggedIn, admin.loadadminlogin)
// adminroute.post("/login", admin.adminLogin)
// adminroute.get("/logout", admin.logout)

// // All other routes — protect with requireAdminLogin
// adminroute.get("/customer", adminauth.requireAdminLogin, admin.loadcustomer)
// adminroute.post("/customer/:id/block", adminauth.requireAdminLogin, admin.blockcustomer)
// adminroute.post("/customer/:id/unblock", adminauth.requireAdminLogin, admin.unblockcustomer)
// adminroute.get("/product", adminauth.requireAdminLogin, admin.loadproduct)
// adminroute.get("/addproduct", adminauth.requireAdminLogin, admin.loadaddproduct)
// adminroute.post("/addproduct", adminauth.requireAdminLogin, uploadproduct.array("images",5), admin.addProduct)
// adminroute.get("/editproduct/:id", adminauth.requireAdminLogin, admin.loadeditproduct)
// adminroute.post("/editproduct/:id", adminauth.requireAdminLogin, uploadproduct.array("images",5), admin.editproduct)
// adminroute.get("/catagory", adminauth.requireAdminLogin, admin.loadcatagory)
// adminroute.get("/addcatagory", adminauth.requireAdminLogin, admin.loadaddcatagory)
// adminroute.post("/addcatagory", adminauth.requireAdminLogin, uploadcatagory.single("image"), admin.addingcatagory)
// adminroute.post("/catagory/:id/block", adminauth.requireAdminLogin, admin.blockcatagory)
// adminroute.post("/catagory/:id/unblock", adminauth.requireAdminLogin, admin.unblockcatagory)
// adminroute.get('/catagory/:id/edit', adminauth.requireAdminLogin, admin.loadEditCatagory)
// adminroute.post('/catagory/:id/edit', adminauth.requireAdminLogin, uploadcatagory.single("image"), admin.updateCategory)
// adminroute.post("/product/:id/block", adminauth.requireAdminLogin, admin.blockproduct)
// adminroute.post("/product/:id/unblock", adminauth.requireAdminLogin, admin.unblockproduct)
// adminroute.get("/order", adminauth.requireAdminLogin, admin.loadorder)
// adminroute.get("/orders/:id", adminauth.requireAdminLogin, admin.loadorderdetails)
// adminroute.post("/orders/:id/status", adminauth.requireAdminLogin, admin.updateOrderStatus)
// adminroute.post("/orders/:id/approve-return", adminauth.requireAdminLogin, admin.approveReturn)
// adminroute.post("/orders/:id/reject-return", adminauth.requireAdminLogin, admin.rejectReturn)
// adminroute.get("/dashboard", adminauth.requireAdminLogin, admin.loadDashboard)
// adminroute.get("/report", adminauth.requireAdminLogin, admin.loadSalesReport)
// adminroute.get("/report/export/csv", adminauth.requireAdminLogin, admin.exportSalesCSV)
// adminroute.get("/offers", adminauth.requireAdminLogin, admin.loadOffers)
// adminroute.get("/addoffer", adminauth.requireAdminLogin, admin.loadAddOffer)
// adminroute.post("/offers/:id/toggle", adminauth.requireAdminLogin, admin.toggleOfferStatus)
// adminroute.get("/offers/edit/:id", adminauth.requireAdminLogin, admin.loadEditOffer)
// adminroute.post("/addoffer", adminauth.requireAdminLogin, admin.createOffer)
// adminroute.post("/offers/edit/:id", adminauth.requireAdminLogin, admin.updateOffer)
// adminroute.get("/coupons", adminauth.requireAdminLogin, admin.loadCoupons)
// adminroute.post("/coupons/:id/toggle", adminauth.requireAdminLogin, admin.toggleCouponStatus)
// adminroute.get("/addcoupon", adminauth.requireAdminLogin, admin.loadAddCoupon)
// adminroute.post("/addcoupon", adminauth.requireAdminLogin, admin.createCoupon)
// adminroute.get("/editcoupon/:id", adminauth.requireAdminLogin, admin.loadEditCoupon)
// adminroute.post("/editcoupon/:id", adminauth.requireAdminLogin, admin.updateCoupon)
// adminroute.get("/report/export/pdf", adminauth.requireAdminLogin, admin.exportSalesPDF);


// module.exports=adminroute
const express = require("express")
const adminroute = express.Router()

// Split controllers
const authController      = require("../controller/admin.auth.controller")
const dashboardController = require("../controller/admin.dashboard.controller")
const productController   = require("../controller/admin.product.controller")
const categoryController  = require("../controller/admin.category.controller")
const customerController  = require("../controller/admin.customer.controller")
const orderController     = require("../controller/admin.order.controller")
const offerController     = require("../controller/admin.offer.controller")
const couponController    = require("../controller/admin.coupon.controller")
const reportController    = require("../controller/admin.report.controller")

const adminauth = require("../middleware/adminauth")
const uploadcatagory = require("../config/catagorymulter")
const uploadproduct = require("../config/productmulter")

// Login routes (no auth needed)
adminroute.get("/login", adminauth.redirectIfAdminLoggedIn, authController.loadadminlogin)
adminroute.post("/login", authController.adminLogin)
adminroute.get("/logout", authController.logout)

// Customers
adminroute.get("/customer", adminauth.requireAdminLogin, customerController.loadcustomer)
adminroute.post("/customer/:id/block", adminauth.requireAdminLogin, customerController.blockcustomer)
adminroute.post("/customer/:id/unblock", adminauth.requireAdminLogin, customerController.unblockcustomer)

// Products
adminroute.get("/product", adminauth.requireAdminLogin, productController.loadproduct)
adminroute.get("/addproduct", adminauth.requireAdminLogin, productController.loadaddproduct)
adminroute.post("/addproduct", adminauth.requireAdminLogin, uploadproduct.array("images", 5), productController.addProduct)
adminroute.get("/editproduct/:id", adminauth.requireAdminLogin, productController.loadeditproduct)
adminroute.post("/editproduct/:id", adminauth.requireAdminLogin, uploadproduct.array("images", 5), productController.editproduct)
adminroute.post("/product/:id/block", adminauth.requireAdminLogin, productController.blockproduct)
adminroute.post("/product/:id/unblock", adminauth.requireAdminLogin, productController.unblockproduct)

// Categories
adminroute.get("/catagory", adminauth.requireAdminLogin, categoryController.loadcatagory)
adminroute.get("/addcatagory", adminauth.requireAdminLogin, categoryController.loadaddcatagory)
adminroute.post("/addcatagory", adminauth.requireAdminLogin, uploadcatagory.single("image"), categoryController.addingcatagory)
adminroute.post("/catagory/:id/block", adminauth.requireAdminLogin, categoryController.blockcatagory)
adminroute.post("/catagory/:id/unblock", adminauth.requireAdminLogin, categoryController.unblockcatagory)
adminroute.get('/catagory/:id/edit', adminauth.requireAdminLogin, categoryController.loadEditCatagory)
adminroute.post('/catagory/:id/edit', adminauth.requireAdminLogin, uploadcatagory.single("image"), categoryController.updateCategory)

// Orders
adminroute.get("/order", adminauth.requireAdminLogin, orderController.loadorder)
adminroute.get("/orders/:id", adminauth.requireAdminLogin, orderController.loadorderdetails)
adminroute.post("/orders/:id/status", adminauth.requireAdminLogin, orderController.updateOrderStatus)
adminroute.post("/orders/:id/approve-return", adminauth.requireAdminLogin, orderController.approveReturn)
adminroute.post("/orders/:id/reject-return", adminauth.requireAdminLogin, orderController.rejectReturn)

// Dashboard
adminroute.get("/dashboard", adminauth.requireAdminLogin, dashboardController.loadDashboard)

// Sales report
adminroute.get("/report", adminauth.requireAdminLogin, reportController.loadSalesReport)
adminroute.get("/report/export/csv", adminauth.requireAdminLogin, reportController.exportSalesCSV)
adminroute.get("/report/export/pdf", adminauth.requireAdminLogin, reportController.exportSalesPDF)

// Offers
adminroute.get("/offers", adminauth.requireAdminLogin, offerController.loadOffers)
adminroute.get("/addoffer", adminauth.requireAdminLogin, offerController.loadAddOffer)
adminroute.post("/addoffer", adminauth.requireAdminLogin, offerController.createOffer)
adminroute.post("/offers/:id/toggle", adminauth.requireAdminLogin, offerController.toggleOfferStatus)
adminroute.get("/offers/edit/:id", adminauth.requireAdminLogin, offerController.loadEditOffer)
adminroute.post("/offers/edit/:id", adminauth.requireAdminLogin, offerController.updateOffer)

// Coupons
adminroute.get("/coupons", adminauth.requireAdminLogin, couponController.loadCoupons)
adminroute.post("/coupons/:id/toggle", adminauth.requireAdminLogin, couponController.toggleCouponStatus)
adminroute.get("/addcoupon", adminauth.requireAdminLogin, couponController.loadAddCoupon)
adminroute.post("/addcoupon", adminauth.requireAdminLogin, couponController.createCoupon)
adminroute.get("/editcoupon/:id", adminauth.requireAdminLogin, couponController.loadEditCoupon)
adminroute.post("/editcoupon/:id", adminauth.requireAdminLogin, couponController.updateCoupon)

module.exports = adminroute