const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type:     String,
    enum:     ['credit', 'debit'],
    required: true
  },
  amount: {
    type:     Number,
    required: true,
    min:      0
  },
  description: {
    type:    String,
    default: ''
  },
  orderId: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Order',
    default: null
  },
  status: {
    type:    String,
    enum:    ['success', 'failed', 'pending'],
    default: 'success'
  }
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'user',   // ✅ matches your User model registration name
    required: true,
    unique:   true
  },
  balance: {
    type:    Number,
    default: 0,
    min:     0
  },
  transactions: [transactionSchema]
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);