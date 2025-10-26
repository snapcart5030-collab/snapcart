// models/DeliveryProgress.js
const mongoose = require("mongoose");

const DeliveryProgressSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  progress: { type: Number, default: 0 }, // from 0 → 500 (or %)
  status: { type: String, enum: ["running", "paused", "completed"], default: "running" },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DeliveryProgress", DeliveryProgressSchema);
