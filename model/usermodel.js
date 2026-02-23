const mongoose=require("mongoose")
const userschema=new mongoose.Schema({
    fullname:{
       type:String,
       require:true
    },
    email:{
        type:String,
        require:true
    },
    password:{
        type:String,
        require:true
    },
    dateofbirth:{
        type:Date,
        require:false
    },
    phonenumber:{
        type:String,
        require:false
    },
    googleId: {
  type: String
},
profileImage: {
  type: String,
require:false
},
 status: { type: String, enum: ["Active", "Blocked"], default: "Active" }


})
module.exports=mongoose.model("user",userschema)