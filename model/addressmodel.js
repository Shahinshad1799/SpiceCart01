const mongoose=require("mongoose")

const addressmodel=new mongoose.Schema({
    userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User"
   },
    fullname:{
        type:String,
        require:true
    },
    phonenumber:{
        type:String,
        require:true
    },
    address:{
        type:String,
        require:true
    },
    appartment:{
        type:String,
        require:true
    },
    city:{
        type:String,
        require:true
    },
    state:{
        type:String,
        require:true
    },
    zipcode:{
        type:String,
        require:true
    },
    isdefault:{
        type:Boolean,
        require:false
    }
})

module.exports=mongoose.model("address",addressmodel)