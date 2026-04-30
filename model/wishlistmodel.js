const mongoose = require('mongoose');
const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variant: {
      name: String,
      price: Number,
      stock: Number,
      variantId: mongoose.Schema.Types.ObjectId
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);