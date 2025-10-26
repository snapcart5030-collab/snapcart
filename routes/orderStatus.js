//routes/orderStatus.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const OrderStatus = require("../models/OrderStatus");
const Order = require("../models/Order");
const transporter = require("../config/mail"); // new mailer
const activeDeliveries = {};


// helper to generate numeric OTP
function generateNumericOtp(len = 6) {
  let otp = "";
  for (let i = 0; i < len; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

/**
 * Export factory: app.use('/orderstatus', require('./routes/orderStatus')(io, onlineUsers));
 */
module.exports = (io, onlineUsers) => {
  // --- existing confirm route (kept as before) ---
  router.post("/confirm", async (req, res) => {
    const { orderId, userEmail } = req.body;
    try {
      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
        orderIdObj = new mongoose.Types.ObjectId(orderId);
      }

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
      console.error("Error in confirm:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- existing cancel route (kept as before) ---
  router.post("/cancel", async (req, res) => {
    const { orderId } = req.body;
    try {
      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) orderIdObj = new mongoose.Types.ObjectId(orderId);

      const canceled = await OrderStatus.findOneAndUpdate(
        { orderId: orderIdObj },
        { status: "canceled", updatedAt: new Date() },
        { new: true }
      );
      if (!canceled) return res.status(404).json({ msg: "Order not found" });

      try {
        await Order.findByIdAndUpdate(orderIdObj, { status: "canceled" });
      } catch (syncErr) {
        console.warn("Order sync failed:", syncErr.message || syncErr);
      }

      io.emit("orderUpdate", { orderId, status: "canceled" });
      res.json({ msg: "Order canceled successfully!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- existing accept route (kept & optionally blocks offline) ---
  // --- accept route + backend animation progress ---
// --- accept route + continuous forward animation (never resets) ---
router.post("/accept", async (req, res) => {
  const { orderId } = req.body;
  try {
    let orderIdObj = orderId;
    if (orderId && mongoose.Types.ObjectId.isValid(orderId))
      orderIdObj = new mongoose.Types.ObjectId(orderId);

    const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj });
    if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

    const userEmail = orderStatus.userEmail;
    if (!userEmail) {
      return res.status(400).json({ msg: "Order user email missing" });
    }

    const updated = await OrderStatus.findOneAndUpdate(
      { orderId: orderIdObj },
      { status: "on-the-way", updatedAt: new Date() },
      { new: true }
    );

    try {
      await Order.findByIdAndUpdate(orderIdObj, { status: "on-the-way" });
    } catch (syncErr) {
      console.warn("Order sync failed:", syncErr.message || syncErr);
    }

    io.emit("orderUpdate", { orderId, status: "on-the-way" });

    // ✅ 10-मिनिटांचा auto-stop loop
    function startProgressLoop() {
      if (activeDeliveries[orderId]) {
        // आधीचा loop चालू असल्यास थांबवा
        clearInterval(activeDeliveries[orderId].intervalId);
        clearTimeout(activeDeliveries[orderId].timeoutId);
      }

      let progress = activeDeliveries[orderId]?.progress || 0;
      const step = 2; 
      const tickMs = 1000; 

      console.log(`🚴‍♂️ Starting delivery loop for ${orderId}`);

      const intervalId = setInterval(async () => {
        try {
          const latest = await OrderStatus.findOne({ orderId: orderIdObj });
          if (!latest || latest.status === "delivered" || latest.status === "canceled") {
            clearInterval(intervalId);
            delete activeDeliveries[orderId];
            console.log(`🛑 Delivery stopped for ${orderId} (status: ${latest?.status})`);
            return;
          }

          progress += step;
          activeDeliveries[orderId].progress = progress;
          io.emit("progressUpdate", { orderId, progress });
        } catch (err) {
          console.error("Animation interval error:", err);
        }
      }, tickMs);

    
      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        console.log(`⏸️ 10 minutes completed for ${orderId}, pausing for 5 sec...`);
        setTimeout(() => startProgressLoop(), 1000); 
      }, 15 * 60 * 1000);

      activeDeliveries[orderId] = { intervalId, timeoutId, progress };
    }

   
    startProgressLoop();

    res.json({ msg: "Order accepted successfully!", orderStatus: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});


  // --- NEW: generate OTP and email to user ---
  router.post("/generate-otp", async (req, res) => {
    const { orderId } = req.body;
    try {
      if (!orderId) return res.status(400).json({ msg: "orderId required" });

      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) orderIdObj = new mongoose.Types.ObjectId(orderId);

      const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj });
      if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

      const otp = generateNumericOtp(6);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      orderStatus.deliveryOtp = otp;
      orderStatus.otpExpiresAt = expiresAt;
      orderStatus.otpAttempts = 0;
      orderStatus.otpVerified = false;
      await orderStatus.save();

      // send email to user
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: orderStatus.userEmail,
        subject: `Your delivery OTP — Order ${orderId}`,
        text: `Your delivery OTP for order ${orderId} is: ${otp}. It expires in 5 minutes.`,
      };

      try {
        await transporter.sendMail(mailOptions);
        res.json({ msg: "OTP generated and emailed to user." });
      } catch (mailErr) {
        console.error("Mail error:", mailErr);
        res.status(500).json({ msg: "Failed to send OTP email." });
      }
    } catch (err) {
      console.error("generate-otp error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- NEW: verify OTP and mark delivered ---
  router.post("/verify-otp", async (req, res) => {
    const { orderId, otp } = req.body;
    try {
      if (!orderId || !otp) return res.status(400).json({ msg: "orderId and otp required" });

      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) orderIdObj = new mongoose.Types.ObjectId(orderId);

      const orderStatus = await OrderStatus.findOne({ orderId: orderIdObj });
      if (!orderStatus) return res.status(404).json({ msg: "Order not found" });

      // check expiry
      if (!orderStatus.deliveryOtp || !orderStatus.otpExpiresAt || new Date() > orderStatus.otpExpiresAt) {
        return res.status(400).json({ msg: "OTP expired or not generated. Please regenerate." });
      }

      // check attempts
      if (orderStatus.otpAttempts >= 5) {
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

      try {
        await Order.findByIdAndUpdate(orderIdObj, { status: "delivered" });
      } catch (syncErr) {
        console.warn("Order sync failed:", syncErr.message || syncErr);
      }

      io.emit("orderUpdate", { orderId, status: "delivered" });
      res.json({ msg: "OTP verified. Order marked as delivered." });
    } catch (err) {
      console.error("verify-otp error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- resend-otp (calls generate-otp logic by duplicating minimal code) ---
  router.post("/resend-otp", async (req, res) => {
    const { orderId } = req.body;
    try {
      if (!orderId) return res.status(400).json({ msg: "orderId required" });
      // reuse the generate-otp flow
      req.url = '/generate-otp';
      return router.handle(req, res);
    } catch (err) {
      console.error("resend-otp error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  // --- fetch all pending/on-the-way/delivered orders (admin) ---
  router.get("/all", async (req, res) => {
    try {
      const orders = await OrderStatus.find({
        status: { $in: ["pending", "on-the-way", "delivered"] },
      }).sort({ updatedAt: -1 });

      res.json(orders);
    } catch (err) {
      console.error("fetch-all error:", err);
      res.status(500).json({ msg: "Server error" });
    }
  });


  // --- NEW: Get current delivery progress (for animation resume) ---
router.get("/deliveryprogress/:orderId", (req, res) => {
  const { orderId } = req.params;
  const progress = activeDeliveries[orderId] || 0;
  res.json({ progress });
});


  // --- get order status by id ---
  router.get("/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      let orderIdObj = orderId;
      if (orderId && mongoose.Types.ObjectId.isValid(orderId)) orderIdObj = new mongoose.Types.ObjectId(orderId);

      const order = await OrderStatus.findOne({ orderId: orderIdObj });
      if (!order) return res.status(404).json({ msg: "Order not found" });
      res.json({ status: order.status });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  });

  return router;
};
