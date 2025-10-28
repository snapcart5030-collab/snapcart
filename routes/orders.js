// routes/orderStatus.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const OrderStatus = require("../models/OrderStatus");
const Order = require("../models/Order");
const transporter = require("../config/mail"); // new mailer

// Active deliveries tracking
const activeDeliveries = {};

// Helper to generate numeric OTP
function generateNumericOtp(len = 6) {
  let otp = "";
  for (let i = 0; i < len; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

/**
 * Export factory: app.use('/orderstatus', require('./routes/orderStatus')(io, onlineUsers));
 */
module.exports = (io, onlineUsers) => {
  // --- Confirm Order ---
  router.post("/confirm", async (req, res) => {
    const { orderId, userEmail } = req.body;
    try {
      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
        orderIdObj = new mongoose.Types.ObjectId(orderId);
      }

      let order = await OrderStatus.findOne({ orderId: orderIdObj }).lean();

      if (!order) {
        order = new OrderStatus({
          orderId: orderIdObj,
          userEmail,
          status: "pending",
        });
        await order.save();
      } else if (order.status === "canceled") {
        await OrderStatus.findOneAndUpdate(
          { orderId: orderIdObj },
          { status: "pending", updatedAt: new Date() }
        );
      } else {
        await OrderStatus.findOneAndUpdate(
          { orderId: orderIdObj },
          { updatedAt: new Date() }
        );
      }

      io.emit("orderUpdate", { orderId, status: "pending" });
      res.json({ msg: "Order confirmed successfully!" });
    } catch (err) {
      console.error("❌ Confirm error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Cancel Order ---
  router.post("/cancel", async (req, res) => {
    const { orderId } = req.body;
    try {
      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId))
        orderIdObj = new mongoose.Types.ObjectId(orderId);

      const canceled = await OrderStatus.findOneAndUpdate(
        { orderId: orderIdObj },
        { status: "canceled", updatedAt: new Date() },
        { new: true }
      ).lean();

      if (!canceled) return res.status(404).json({ msg: "Order not found" });

      // Run order sync in background
      Order.findByIdAndUpdate(orderIdObj, { status: "canceled" }).catch(console.warn);

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
      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId))
        orderIdObj = new mongoose.Types.ObjectId(orderId);

      const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj }).lean();
      if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

      const updated = await OrderStatus.findOneAndUpdate(
        { orderId: orderIdObj },
        { status: "on-the-way", updatedAt: new Date() },
        { new: true }
      ).lean();

      Order.findByIdAndUpdate(orderIdObj, { status: "on-the-way" }).catch(console.warn);

      io.emit("orderUpdate", { orderId, status: "on-the-way" });

      // ✅ Background Delivery Progress Loop
      function startProgressLoop() {
        if (activeDeliveries[orderId]) {
          clearInterval(activeDeliveries[orderId].intervalId);
          clearTimeout(activeDeliveries[orderId].timeoutId);
        }

        let progress = activeDeliveries[orderId]?.progress || 0;
        const step = 2;
        const tickMs = 1000; // 1 second

        const intervalId = setInterval(async () => {
          try {
            // Every 10 sec, check DB (not every 1 sec)
            if (progress % 10 === 0) {
              const latest = await OrderStatus.findOne({ orderId: orderIdObj })
                .select("status")
                .lean();
              if (!latest || ["delivered", "canceled"].includes(latest.status)) {
                clearInterval(intervalId);
                delete activeDeliveries[orderId];
                return;
              }
            }

            progress += step;
            activeDeliveries[orderId].progress = progress;
            io.emit("progressUpdate", { orderId, progress });
          } catch (err) {
            console.error("Progress loop error:", err);
          }
        }, tickMs);

        // auto pause after 15 min
        const timeoutId = setTimeout(() => {
          clearInterval(intervalId);
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
  router.post("/generate-otp", async (req, res) => {
    const { orderId } = req.body;
    try {
      if (!orderId) return res.status(400).json({ msg: "orderId required" });

      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId))
        orderIdObj = new mongoose.Types.ObjectId(orderId);

      const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj }).lean();
      if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

      const otp = generateNumericOtp(6);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await OrderStatus.updateOne(
        { orderId: orderIdObj },
        {
          deliveryOtp: otp,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          otpVerified: false,
        }
      );

      // Send mail asynchronously (non-blocking)
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: orderStatus.userEmail,
        subject: `Your delivery OTP — Order ${orderId}`,
        text: `Your delivery OTP for order ${orderId} is: ${otp}. It expires in 5 minutes.`,
      };

      transporter.sendMail(mailOptions)
        .then(() => console.log(`📧 OTP sent to ${orderStatus.userEmail}`))
        .catch(err => console.error("Mail send error:", err));

      res.json({ msg: "OTP generated. Email is being sent." });
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

      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId))
        orderIdObj = new mongoose.Types.ObjectId(orderId);

      const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj }).lean();
      if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

      if (
        !orderStatus.deliveryOtp ||
        !orderStatus.otpExpiresAt ||
        new Date() > orderStatus.otpExpiresAt
      ) {
        return res.status(400).json({ msg: "OTP expired or not generated." });
      }

      if (orderStatus.otpAttempts >= 5) {
        return res.status(429).json({ msg: "Too many attempts. Please regenerate OTP." });
      }

      if (String(orderStatus.deliveryOtp) !== String(otp).trim()) {
        await OrderStatus.updateOne(
          { orderId: orderIdObj },
          { $inc: { otpAttempts: 1 } }
        );
        return res.status(400).json({ msg: "Invalid OTP" });
      }

      await OrderStatus.updateOne(
        { orderId: orderIdObj },
        {
          otpVerified: true,
          deliveryOtp: undefined,
          otpExpiresAt: undefined,
          status: "delivered",
          updatedAt: new Date(),
        }
      );

      Order.findByIdAndUpdate(orderIdObj, { status: "delivered" }).catch(console.warn);
      io.emit("orderUpdate", { orderId, status: "delivered" });

      res.json({ msg: "OTP verified. Order marked as delivered." });
    } catch (err) {
      console.error("❌ Verify OTP error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- Resend OTP ---
  router.post("/resend-otp", async (req, res) => {
    req.url = "/generate-otp";
    router.handle(req, res);
  });

  // --- Fetch all active orders ---
  router.get("/all", async (req, res) => {
    try {
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
    const progress = activeDeliveries[orderId]?.progress || 0;
    res.json({ progress });
  });

  // --- Get order status by ID ---
  router.get("/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId))
        orderIdObj = new mongoose.Types.ObjectId(orderId);

      const order = await OrderStatus.findOne({ orderId: orderIdObj })
        .select("status")
        .lean();
      if (!order) return res.status(404).json({ msg: "Order not found" });

      res.json({ status: order.status });
    } catch (err) {
      console.error("❌ Get status error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  return router;
};
