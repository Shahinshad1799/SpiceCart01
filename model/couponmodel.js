const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "fixed", "shipping"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    maxDiscount: {
        type: Number,
        default: null
    },
    minPurchase: {
        type: Number,
        default: 0
    },
    usageLimit: {
        type: Number,
        default: 1
    },
    usedCount: {
        type: Number,
        default: 0
    },
    expiryDate: {
        type: Date,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Coupon", couponSchema);