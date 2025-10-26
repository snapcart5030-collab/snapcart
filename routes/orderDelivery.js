// routes/orderDelivery.js
const express = require("express");

// Attempt to require model with both possible spellings if necessary
let DeliveryOTP;
try {
  DeliveryOTP = require("../models/DeliveryOTP");
} catch (e1) {
  try {
    DeliveryOTP = require("../models/DeleveryOTP"); // fallback in case file is misspelled
    console.warn("Loaded models/DeleveryOTP (fallback). Consider renaming file to DeliveryOTP for clarity.");
  } catch (e2) {
    console.error("Failed to require DeliveryOTP model (tried DeliveryOTP and DeleveryOTP):", e1 || e2);
    // keep DeliveryOTP undefined; routes will handle it
  }
}

const OrderStatus = require("../models/OrderStatus");
const mailer = require("../config/mail"); // console-only mailer

const router = express.Router();

// generate OTP (console-only + store in DeliveryOTP)
router.post("/generate-otp", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      console.warn("generate-otp called without orderId");
      return res.status(400).json({ msg: "orderId required" });
    }

    // Basic guard: ensure model is loaded
    if (!DeliveryOTP) {
      console.error("DeliveryOTP model not loaded. Check file name in models folder.");
      return res.status(500).json({ msg: "Server config error: DeliveryOTP model missing" });
    }

    // generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // remove previous
    try {
      await DeliveryOTP.findOneAndDelete({ orderId });
    } catch (delErr) {
      console.warn("Could not delete previous OTP (non-fatal):", delErr.message || delErr);
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const created = await DeliveryOTP.create({ orderId, otp, expiresAt });

    // log to console (this is the main message you expect)
    console.log(`📦 [Console OTP] Order ${orderId} OTP: ${otp}`);

    // mailer (console) - optional
    try {
      await mailer.sendMail({
        to: "console-only@example.com",
        subject: `OTP for Order ${orderId}`,
        text: `OTP: ${otp} (expires in 10 minutes)`,
      });
      console.log("Mailer: logged OTP to console-only email.");
    } catch (mailErr) {
      console.warn("Mailer error (non-fatal):", mailErr.message || mailErr);
    }

    return res.json({ msg: "OTP generated (check server console)", otpId: created._id });
  } catch (err) {
    console.error("generate-otp error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// verify OTP (mark delivered)
router.post("/verify-otp", async (req, res) => {
  try {
    const { orderId, otp } = req.body;
    if (!orderId || !otp) return res.status(400).json({ msg: "orderId and otp required" });

    if (!DeliveryOTP) {
      console.error("DeliveryOTP model not loaded. Check file name in models folder.");
      return res.status(500).json({ msg: "Server config error: DeliveryOTP model missing" });
    }

    const rec = await DeliveryOTP.findOne({ orderId });
    if (!rec) return res.status(400).json({ msg: "No OTP found for this order" });
    if (rec.expiresAt < new Date()) return res.status(400).json({ msg: "OTP expired" });
    if (rec.otp !== String(otp).trim()) return res.status(400).json({ msg: "Invalid OTP" });

    // mark OrderStatus delivered
    await OrderStatus.findOneAndUpdate(
      { orderId },
      { status: "delivered", otpVerified: true, updatedAt: new Date() }
    );

    await DeliveryOTP.deleteOne({ orderId });

    // ✅ Stop delivery animation if running
    const activeDeliveries = req.app.get("activeDeliveries");
    if (activeDeliveries && activeDeliveries[orderId]) {
      clearInterval(activeDeliveries[orderId].intervalId);
      clearTimeout(activeDeliveries[orderId].timeoutId);
      delete activeDeliveries[orderId];
      console.log(`✅ Animation permanently stopped after delivery for ${orderId}`);
    }

    // emit via socket (io stored on app)
    const io = req.app.get("io");
    if (io) io.emit("orderUpdate", { orderId, status: "delivered" });

    console.log(`✅ Order ${orderId} delivered (OTP verified)`);

    return res.json({ msg: "Order delivered successfully" });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
