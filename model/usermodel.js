const mongoose=require("mongoose")
const userschema=new mongoose.Schema({
    fullname:{
       type:String,
       require:true
    },
    email:{
        type:String,
        require:true,
        unique:true
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
referralCode: {
  type: String,
  unique: true,
  sparse: true
},
referredBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'user',
  default: null
},
referralRewardGiven: {
  type: Boolean,
  default: false
},
 status: { type: String, enum: ["Active", "Blocked"], default: "Active" }


})
module.exports=mongoose.model("user",userschema)