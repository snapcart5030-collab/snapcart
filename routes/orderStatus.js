// routes/orderStatus.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const OrderStatus = require("../models/OrderStatus");
const Order = require("../models/Order");
const transporter = require("../config/mail"); // your mailer

// Active deliveries tracking (in-memory)
const activeDeliveries = {};

// helper to generate numeric OTP
function generateNumericOtp(len = 6) {
  let otp = "";
  for (let i = 0; i < len; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

// helper: try to convert to ObjectId when valid, otherwise return original
function toObjectIdIfPossible(id) {
  if (!id) return id;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
  } catch (e) {
    // ignore
  }
  return id;
}

/**
 * Export factory: app.use('/orderstatus', require('./routes/orderStatus')(io, onlineUsers));
 */
module.exports = (io, onlineUsers) => {
  // --- Confirm Order ---
  router.post("/confirm", async (req, res) => {
    const { orderId, userEmail } = req.body;
    try {
      let orderIdObj = toObjectIdIfPossible(orderId);

      // find existing by orderId or create
      let order = await OrderStatus.findOne({ orderId: orderIdObj });

      if (!order) {
        order = new OrderStatus({
          orderId: orderIdObj,
          userEmail,
          status: "pending",
        });
        await order.save();
      } else if (order.status === "canceled") {
        order.status = "pending";
        order.updatedAt = new Date();
        await order.save();
      } else {
        order.updatedAt = new Date();
        await order.save();
      }

      io.emit("orderUpdate", { orderId, status: "pending" });
      res.json({ msg: "Order confirmed successfully!", order });
    } catch (err) {
      console.error("❌ Confirm error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Cancel Order ---
  router.post("/cancel", async (req, res) => {
    const { orderId } = req.body;
    try {
      let orderIdObj = toObjectIdIfPossible(orderId);

      const canceled = await OrderStatus.findOneAndUpdate(
        { orderId: orderIdObj },
        { status: "canceled", updatedAt: new Date() },
        { new: true }
      );

      if (!canceled) return res.status(404).json({ msg: "Order not found" });

      // best-effort sync to Order collection (non-blocking)
      Order.findByIdAndUpdate(orderIdObj, { status: "canceled" }).catch((e) =>
        console.warn("Order sync failed (cancel):", e && e.message ? e.message : e)
      );

      io.emit("orderUpdate", { orderId, status: "canceled" });
      res.json({ msg: "Order canceled successfully!" });
    } catch (err) {
      console.error("❌ Cancel error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Accept Order + Delivery Progress ---
  router.post("/accept", async (req, res) => {
    const { orderId } = req.body;
    try {
      let orderIdObj = toObjectIdIfPossible(orderId);
      const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj });

      if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

      // ensure userEmail exists (your original check)
      const userEmail = orderStatus.userEmail;
      if (!userEmail) {
        return res.status(400).json({ msg: "Order user email missing" });
      }

      const updated = await OrderStatus.findOneAndUpdate(
        { orderId: orderIdObj },
        { status: "on-the-way", updatedAt: new Date() },
        { new: true }
      );

      // best-effort sync to Order collection (non-blocking)
      Order.findByIdAndUpdate(orderIdObj, { status: "on-the-way" }).catch((e) =>
        console.warn("Order sync failed (accept):", e && e.message ? e.message : e)
      );

      io.emit("orderUpdate", { orderId, status: "on-the-way" });

      // Background delivery progress loop
      function startProgressLoop() {
        // If there's an existing loop, clear it first
        if (activeDeliveries[orderId]) {
          try {
            clearInterval(activeDeliveries[orderId].intervalId);
            clearTimeout(activeDeliveries[orderId].timeoutId);
          } catch (e) {
            // ignore
          }
        }

        // resume from previous progress if available
        let progress = activeDeliveries[orderId]?.progress || 0;
        const step = 2; // how much to increment each tick
        const tickMs = 1000; // 1 second tick

        console.log(`🚴‍♂️ Starting delivery loop for ${orderId} (resume at ${progress})`);

        const intervalId = setInterval(async () => {
          try {
            // every tick, check DB status to stop if delivered/canceled
            const latest = await OrderStatus.findOne({ orderId: orderIdObj }).select("status").lean();
            if (!latest || ["delivered", "canceled"].includes(latest.status)) {
              clearInterval(intervalId);
              delete activeDeliveries[orderId];
              console.log(`🛑 Delivery stopped for ${orderId} (status: ${latest?.status})`);
              return;
            }

            progress += step;
            // persist progress in-memory
            activeDeliveries[orderId] = activeDeliveries[orderId] || {};
            activeDeliveries[orderId].progress = progress;

            io.emit("progressUpdate", { orderId, progress });
          } catch (err) {
            console.error("Progress loop error:", err);
          }
        }, tickMs);

        // auto-pause and restart behavior (keeps original pattern)
        const timeoutId = setTimeout(() => {
          clearInterval(intervalId);
          console.log(`⏸️ 15 minutes completed for ${orderId}, pausing before restart...`);
          // restart after short delay (matching earlier pattern)
          setTimeout(() => startProgressLoop(), 1000);
        }, 15 * 60 * 1000);

        activeDeliveries[orderId] = { intervalId, timeoutId, progress };
      }

      startProgressLoop();

      res.json({ msg: "Order accepted successfully!", orderStatus: updated });
    } catch (err) {
      console.error("❌ Accept error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Generate OTP ---
  async function generateAndSendOtp(orderId) {
    if (!orderId) throw new Error("orderId required");
    const orderIdObj = toObjectIdIfPossible(orderId);

    const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj });
    if (!orderStatus) throw new Error("Order not found");

    const otp = generateNumericOtp(6);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    orderStatus.deliveryOtp = otp;
    orderStatus.otpExpiresAt = expiresAt;
    orderStatus.otpAttempts = 0;
    orderStatus.otpVerified = false;
    await orderStatus.save();

    // mail options
    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: orderStatus.userEmail,
      subject: `Your delivery OTP — Order ${orderId}`,
      text: `Your delivery OTP for order ${orderId} is: ${otp}. It expires in 5 minutes.`,
    };

    // send mail (returns promise)
    return transporter.sendMail(mailOptions);
  }

  router.post("/generate-otp", async (req, res) => {
    const { orderId } = req.body;
    try {
      if (!orderId) return res.status(400).json({ msg: "orderId required" });

      try {
        await generateAndSendOtp(orderId);
        // keep identical response to previous logic
        res.json({ msg: "OTP generated and email is being sent." });
      } catch (innerErr) {
        console.error("Mail/send error (generate-otp):", innerErr);
        // if order not found, send 404; if mail failed, send 500 with message
        if (String(innerErr).toLowerCase().includes("order not found")) {
          return res.status(404).json({ msg: "Order not found" });
        }
        return res.status(500).json({ msg: "Failed to send OTP email." });
      }
    } catch (err) {
      console.error("❌ Generate OTP error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Verify OTP ---
  router.post("/verify-otp", async (req, res) => {
    const { orderId, otp } = req.body;
    try {
      if (!orderId || !otp) return res.status(400).json({ msg: "orderId and otp required" });

      let orderIdObj = toObjectIdIfPossible(orderId);
      const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj });
      if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

      // check expiry
      if (!orderStatus.deliveryOtp || !orderStatus.otpExpiresAt || new Date() > orderStatus.otpExpiresAt) {
        return res.status(400).json({ msg: "OTP expired or not generated. Please regenerate." });
      }

      // attempts limit
      if ((orderStatus.otpAttempts || 0) >= 5) {
        return res.status(429).json({ msg: "Too many attempts. Please regenerate OTP." });
      }

      if (String(orderStatus.deliveryOtp) !== String(otp).trim()) {
        orderStatus.otpAttempts = (orderStatus.otpAttempts || 0) + 1;
        await orderStatus.save();
        return res.status(400).json({ msg: "Invalid OTP" });
      }

      // OTP correct -> mark delivered
      orderStatus.otpVerified = true;
      orderStatus.deliveryOtp = undefined;
      orderStatus.otpExpiresAt = undefined;
      orderStatus.status = "delivered";
      orderStatus.updatedAt = new Date();
      await orderStatus.save();

      // best-effort sync to Order
      Order.findByIdAndUpdate(orderIdObj, { status: "delivered" }).catch((e) =>
        console.warn("Order sync failed (verify-otp):", e && e.message ? e.message : e)
      );

      io.emit("orderUpdate", { orderId, status: "delivered" });
      res.json({ msg: "OTP verified. Order marked as delivered." });
    } catch (err) {
      console.error("❌ Verify OTP error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Resend OTP (reuses generateAndSendOtp)
  router.post("/resend-otp", async (req, res) => {
    const { orderId } = req.body;
    try {
      if (!orderId) return res.status(400).json({ msg: "orderId required" });
      try {
        await generateAndSendOtp(orderId);
        res.json({ msg: "OTP regenerated and emailed to user." });
      } catch (innerErr) {
        console.error("resend-otp error:", innerErr);
        if (String(innerErr).toLowerCase().includes("order not found")) {
          return res.status(404).json({ msg: "Order not found" });
        }
        return res.status(500).json({ msg: "Failed to resend OTP email." });
      }
    } catch (err) {
      console.error("❌ resend-otp error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Fetch all active orders (keeps same filter you used earlier) ---
  router.get("/all", async (req, res) => {
    try {
      // NOTE: kept same behavior (only pending/on-the-way/delivered) — no logic change
      const orders = await OrderStatus.find({
        status: { $in: ["pending", "on-the-way", "delivered"] },
      })
        .sort({ updatedAt: -1 })
        .lean();
      res.json(orders);
    } catch (err) {
      console.error("❌ Fetch all error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Get current delivery progress ---
  router.get("/deliveryprogress/:orderId", (req, res) => {
    const { orderId } = req.params;
    // return numeric progress (0 if not tracked)
    const progress = activeDeliveries[orderId]?.progress || 0;
    res.json({ progress });
  });

  // --- Get order status by ID ---
  router.get("/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      let orderIdObj = toObjectIdIfPossible(orderId);

      const order = await OrderStatus.findOne({ orderId: orderIdObj }).select("status").lean();
      if (!order) return res.status(404).json({ msg: "Order not found" });
      res.json({ status: order.status });
    } catch (err) {
      console.error("❌ Get status error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  return router;
};
