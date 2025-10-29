// routes/order.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderStatus = require("../models/OrderStatus");

// ✅ Create a new order
router.post("/", async (req, res) => {
  try {
    const { userEmail, username, mobile, products, totalAmount, location } = req.body;

    if (!userEmail || !products?.length)
      return res.status(400).json({ msg: "User email and products required." });

    const newOrder = new Order({
      userEmail,
      username,
      mobile,
      products,
      totalAmount,
      location,
      status: "pending",
    });

    const savedOrder = await newOrder.save();

    // Create linked OrderStatus
    const statusDoc = await OrderStatus.create({
      orderId: savedOrder._id,
      userEmail,
      status: "pending",
    });

    savedOrder.statusRef = statusDoc._id;
    await savedOrder.save();

    res.json({ msg: "Order placed successfully!", order: savedOrder });
  } catch (err) {
    console.error("❌ Create order error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Get all orders (optionally filtered by user)
router.get("/", async (req, res) => {
  try {
    const { userEmail } = req.query;
    const filter = userEmail ? { userEmail } : {};
    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error("❌ Fetch orders error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Get single order details
router.get("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ msg: "Invalid order ID" });

    const order = await Order.findById(orderId).populate("statusRef").lean();
    if (!order) return res.status(404).json({ msg: "Order not found" });

    res.json(order);
  } catch (err) {
    console.error("❌ Fetch order error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Delete an order
router.delete("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ msg: "Invalid order ID" });

    const deleted = await Order.findByIdAndDelete(orderId);
    if (!deleted) return res.status(404).json({ msg: "Order not found" });

    await OrderStatus.findOneAndDelete({ orderId });
    res.json({ msg: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ Delete order error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
