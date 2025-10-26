// routes/deliveryProgress.js
const express = require("express");
const router = express.Router();
const DeliveryProgress = require("../models/DeliveryProgress");
const OrderStatus = require("../models/OrderStatus");

module.exports = (io) => {
  // Initialize progress when order becomes 'on-the-way'
  router.post("/start", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ msg: "orderId required" });

      const existing = await DeliveryProgress.findOne({ orderId });
      if (!existing) {
        await DeliveryProgress.create({ orderId, progress: 0, status: "running" });
      }
      io.emit("progressUpdate", { orderId, progress: 0 });
      res.json({ msg: "Progress started" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // Simulate progress increment (backend controlled)
  router.post("/tick", async (req, res) => {
    try {
      const { orderId } = req.body;
      const progress = await DeliveryProgress.findOne({ orderId });
      if (!progress) return res.status(404).json({ msg: "Progress not found" });
      if (progress.status === "completed") return res.json({ msg: "Already completed" });

      // Increment progress slowly (for example +10)
      progress.progress = Math.min(progress.progress + 10, 500);
      progress.updatedAt = new Date();
      if (progress.progress >= 500) progress.status = "completed";
      await progress.save();

      io.emit("progressUpdate", { orderId, progress: progress.progress });
      res.json({ msg: "Progress updated", progress });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // Get current progress
  router.get("/:orderId", async (req, res) => {
    try {
      const progress = await DeliveryProgress.findOne({ orderId: req.params.orderId });
      if (!progress) return res.status(404).json({ msg: "Progress not found" });
      res.json(progress);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // Mark completed when OTP verified (called from verify-otp)
  router.post("/complete", async (req, res) => {
    try {
      const { orderId } = req.body;
      const progress = await DeliveryProgress.findOneAndUpdate(
        { orderId },
        { progress: 500, status: "completed", updatedAt: new Date() },
        { new: true }
      );
      io.emit("progressUpdate", { orderId, progress: 500 });
      res.json({ msg: "Progress completed", progress });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  return router;
};
