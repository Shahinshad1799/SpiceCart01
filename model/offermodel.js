const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Offer title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value must be positive"],
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    maxDiscountCap: {
      type: Number,
      default: null,
    },
    applicableFor: {
      type: String,
      enum: ["all", "product", "category", "user"],
      default: "all",
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // product/category/user id based on applicableFor
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      sparse: true,
    },
    usageLimit: {
      type: Number,
      default: null, // null = unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    status: {
      type: String,
      enum: ["draft", "active", "expired"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire offers past their endDate
// offerSchema.pre("save", function (next) {
//   if (this.endDate && this.endDate < new Date() && this.status === "active") {
//     this.status = "expired";
//   }
//   next();
// });

// // Validate endDate > startDate
// offerSchema.pre("save", function (next) {
//   if (this.endDate <= this.startDate) {
//     return next(new Error("End date must be after start date"));
//   }
//   next();
// });

module.exports = mongoose.model("Offer", offerSchema);