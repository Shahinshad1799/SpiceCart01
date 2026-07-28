const mongoose=require("mongoose")

const connectdb=async()=>{
   try{
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("db connected successfully")
   }catch(error){
    console.log("connection failed")
    process.exit(1)
   }
}

module.exports=connectdb