// models/ DeleveryOTP.js
const mongoose = require("mongoose");

const DeliveryOTPSchema = new mongoose.Schema({
  orderId: { type: String, required: true }, // store as string for consistent handling
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model("DeliveryOTP", DeliveryOTPSchema);
