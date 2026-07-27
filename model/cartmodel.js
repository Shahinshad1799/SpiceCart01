// models/Cart.js

const mongoose = require("mongoose");

const cartmodel = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  items: [
    {
      productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product" 
      },

      variantId: {             
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },

      quantity: { 
        type: Number, 
        default: 1 
      },

      price: {                
        type: Number,
        required: true
      }
    }
  ]
});

module.exports = mongoose.model("Cart", cartmodel);