const mongoose = require("mongoose")

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
        require: true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        require: true
    },
    productName: {
        type: String,
        require: true
    },
    productImage: {
        type: String,
        require: false
    },
    unitPrice: {
        type: Number,
        require: true
    },
    quantity: {
        type: Number,
        require: true
    },
    lineTotal: {
        type: Number,
        require: true
    },
    itemStatus: {
        type: String,
        enum: ["active", "cancelled"],
        default: "active"
    },
    cancelReason: {
        type: String,
        default: null
    }
})

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        require: true
    },

    // Snapshot of address at order time
    shippingAddress: {
        addressId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "address"
        },
        fullname: {
            type: String,
            require: true
        },
        phonenumber: {
            type: String,
            require: true
        },
        address: {
            type: String,
            require: true
        },
        appartment: {
            type: String,
            require: true
        },
        city: {
            type: String,
            require: true
        },
        state: {
            type: String,
            require: true
        },
        zipcode: {
            type: String,
            require: true
        }
    },

    items: [orderItemSchema],

    paymentMethod: {
        type: String,
        enum: ["cash_on_delivery", "online",'wallet'],
        default: "cash_on_delivery"
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },

    status: {
        type: String,
        enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned", "refunded"],
        default: "pending"
    },
    // orderSchema — add this field
cancelReason: {
  type: String,
  default: null
},
returnRequest: {
  reason:      String,
  details:     String,
  refundMethod: String,  // original_payment | store_credit | bank_transfer
  status:      { type: String, enum: ['requested', 'approved', 'rejected', 'completed'], default: 'requested' },
  requestedAt: Date,
  adminNote:   String,   // filled by admin when rejecting
},

    subtotal: {
        type: Number,
        require: true
    },
    shipping: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
      discount: {
        type: Number,
        default: 0
    },
    couponCode: {
        type: String,
        default: null
    },
    total: {
        type: Number,
        require: true
    }

}, { timestamps: true })

module.exports = mongoose.model("order", orderSchema)