const mongoose = require('mongoose');

const OrderStatusSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
  userEmail: { type: String, required: true },
  status: { type: String, enum: ["pending","on-the-way","canceled","delivered"], default: "pending" },
  deliveryOtp: { type: String },
  otpExpiresAt: { type: Date },
  otpAttempts: { type: Number, default: 0 },
  otpVerified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('OrderStatus', OrderStatusSchema);
