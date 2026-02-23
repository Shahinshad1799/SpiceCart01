const mongoose=require("mongoose")

const connectdb=async()=>{
   try{
    await mongoose.connect("mongodb://127.0.0.1:27017/spicecart")
    console.log("db connected successfully")
   }catch(error){
    console.log("connection failed")
    process.exit(1)
   }
}

module.exports=connectdb