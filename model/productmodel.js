const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    default: 0,
  }
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },

    variants: [variantSchema],

  images: {
  type: [String],
  default: []
},
 catagory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Catagory"
  },
  
   status: { type: String, enum: ["Active", "Blocked"], default: "Active" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);