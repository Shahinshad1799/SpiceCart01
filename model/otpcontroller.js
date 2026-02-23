const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true
    },

    otp: {
      type: String,
      required: true
    },

    expiresAt: {
      type: Date,
      required: true
    },

    isVerified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
