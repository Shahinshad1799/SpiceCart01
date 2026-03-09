const express=require("express")
const admin=require("../controller/admincontroller")
const adminroute=express.Router()
const usermodel=require("../model/usermodel")
const adminauth=require("../middleware/adminauth")
  
adminroute.get("/login",adminauth.requireAdminLogin,admin.loadadminlogin)
adminroute.post("/login",admin.adminLogin)
adminroute.get("/customer",adminauth.redirectIfAdminLoggedIn,admin.loadcustomer)
adminroute.post("/customer/:id/block",admin.blockcustomer);
adminroute.get("/product",admin.loadproduct)
adminroute.get("/addproduct",admin.loadaddproduct)
adminroute.get("/catagory",admin.loadcatagory)
adminroute.get("/addcatagory",admin.loadaddcatagory)

// Unblock customer
adminroute.post("/customer/:id/unblock",admin.unblockcustomer);
adminroute.post("/logout", admin.logout);


module.exports=adminroute
