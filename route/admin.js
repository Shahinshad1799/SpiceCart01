const express=require("express")
const admin=require("../controller/admincontroller")
const adminroute=express.Router()
const usermodel=require("../model/usermodel")
const adminauth=require("../middleware/adminauth")
 const uploadcatagory=require("../config/catagorymulter")
 const uploadproduct=require("../config/productmulter")
  
adminroute.get("/login",adminauth.requireAdminLogin,admin.loadadminlogin)
adminroute.post("/login",admin.adminLogin)
adminroute.get("/customer",adminauth.redirectIfAdminLoggedIn,admin.loadcustomer)
adminroute.post("/customer/:id/block",admin.blockcustomer);
adminroute.get("/product",admin.loadproduct)
adminroute.get("/addproduct",admin.loadaddproduct)
adminroute.post("/addproduct",uploadproduct.array("images",5),admin.addProduct)
adminroute.get("/editproduct/:id",admin.loadeditproduct)
adminroute.post("/editproduct/:id",uploadproduct.array("images",5),admin.editproduct)
adminroute.get("/catagory",admin.loadcatagory)
adminroute.get("/addcatagory",admin.loadaddcatagory)
adminroute.post("/addcatagory",uploadcatagory.single("image"),admin.addingcatagory)

// Unblock customer
adminroute.post("/customer/:id/unblock",admin.unblockcustomer);

adminroute.post("/catagory/:id/block",admin.blockcatagory);
adminroute.post("/catagory/:id/unblock",admin.unblockcatagory);
adminroute.post("/product/:id/block",admin.blockproduct);
adminroute.post("/product/:id/unblock",admin.unblockproduct);
adminroute.get('/catagory/:id/edit',admin.loadEditCatagory);
adminroute.post('/catagory/:id/edit',uploadcatagory.single("image"),admin.updateCategory);


adminroute.get("/order",admin.loadorder)
adminroute.get("/orders/:id",admin.loadorderdetails)
adminroute.post("/orders/:id/status",admin.updateOrderStatus);
adminroute.post("/orders/:id/approve-return",admin.approveReturn);

adminroute.post("/orders/:id/reject-return",admin.rejectReturn);

adminroute.post("/logout", admin.logout);



module.exports=adminroute
