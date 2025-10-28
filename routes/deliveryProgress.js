// routes/deliveryProgress.js
const express = require("express");
const router = express.Router();
const DeliveryProgress = require("../models/DeliveryProgress");

module.exports = (io) => {
  // ✅ Initialize progress when order becomes 'on-the-way'
  router.post("/start", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId)
        return res.status(400).json({ msg: "orderId required" });

      // 🔹 Use upsert for single atomic operation (faster than find + create)
      await DeliveryProgress.updateOne(
        { orderId },
        { $setOnInsert: { progress: 0, status: "running", createdAt: new Date() } },
        { upsert: true }
      );

      io.emit("progressUpdate", { orderId, progress: 0 });
      res.json({ msg: "Progress started" });
    } catch (err) {
      console.error("❌ Start Progress Error:", err.message || err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // ✅ Simulate progress increment (backend controlled)
  router.post("/tick", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId)
        return res.status(400).json({ msg: "orderId required" });

      // 🔹 Increment progress directly in DB (no read-modify-write lag)
      const updated = await DeliveryProgress.findOneAndUpdate(
        { orderId, status: { $ne: "completed" } },
        [
          {
            $set: {
              progress: {
                $min: [{ $add: ["$progress", 10] }, 500],
              },
              updatedAt: new Date(),
              status: {
                $cond: [
                  { $gte: [{ $add: ["$progress", 10] }, 500] },
                  "completed",
                  "running",
                ],
              },
            },
          },
        ],
        { new: true }
      ).lean();

      if (!updated)
        return res.status(404).json({ msg: "Progress not found or already completed" });

      io.emit("progressUpdate", {
        orderId,
        progress: updated.progress,
      });

      res.json({ msg: "Progress updated", progress: updated });
    } catch (err) {
      console.error("❌ Tick Progress Error:", err.message || err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // ✅ Get current progress
  router.get("/:orderId", async (req, res) => {
    try {
      const progress = await DeliveryProgress.findOne({
        orderId: req.params.orderId,
      })
        .lean()
        .select("orderId progress status updatedAt");
      if (!progress)
        return res.status(404).json({ msg: "Progress not found" });

      res.json(progress);
    } catch (err) {
      console.error("❌ Get Progress Error:", err.message || err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // ✅ Mark completed when OTP verified (called from verify-otp)
  router.post("/complete", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId)
        return res.status(400).json({ msg: "orderId required" });

      const progress = await DeliveryProgress.findOneAndUpdate(
        { orderId },
        {
          $set: {
            progress: 500,
            status: "completed",
            updatedAt: new Date(),
          },
        },
        { new: true }
      ).lean();

      if (!progress)
        return res.status(404).json({ msg: "Progress not found" });

      io.emit("progressUpdate", { orderId, progress: 500 });
      res.json({ msg: "Progress completed", progress });
    } catch (err) {
      console.error("❌ Complete Progress Error:", err.message || err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  return router;
};
