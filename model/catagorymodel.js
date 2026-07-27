const mongoose = require("mongoose");

const catagorymodel = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    description: {
      type: String,
      required: true
    },

    image: {
      type: String,  
      required: true
    },

   status: { type: String, enum: ["Active", "Blocked"], default: "Active" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Catagory", catagorymodel);