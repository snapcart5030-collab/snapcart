// routes/order.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderStatus = require("../models/OrderStatus");
const Cart = require("../models/Cart");

// ✅ Create a new order
router.post("/", async (req, res) => {
  try {
    const { userEmail, username, mobile, products, totalAmount, location } = req.body;

    console.log("📦 Incoming Order Body:", req.body);

    if (!userEmail) {
      return res.status(400).json({ msg: "❌ userEmail is required." });
    }
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ msg: "❌ products must be a non-empty array." });
    }

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

    const statusDoc = await OrderStatus.create({
      orderId: savedOrder._id,
      userEmail,
      status: "pending",
    });

    savedOrder.statusRef = statusDoc._id;
    await savedOrder.save();

    res.json({ msg: "✅ Order placed successfully!", order: savedOrder });
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

// ✅ Checkout and place order (fixed)
router.post("/checkout", async (req, res) => {
  try {
    const { userEmail, username, mobile, latitude, longitude, address } = req.body;

    console.log("🧾 Checkout Request Body:", req.body);

    if (!userEmail) {
      return res.status(400).json({ msg: "User not authenticated. Please login first." });
    }

    // Fetch user's cart
    const cartItems = await Cart.find({ userEmail });
    if (!cartItems?.length) {
      return res.status(400).json({ msg: "Cart is empty." });
    }

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const newOrder = new Order({
      userEmail,
      username,
      mobile,
      products: cartItems,
      totalAmount,
      location: { latitude, longitude, address },
      status: "pending",
    });

    const savedOrder = await newOrder.save();

    const statusDoc = await OrderStatus.create({
      orderId: savedOrder._id,
      userEmail,
      status: "pending",
    });

    savedOrder.statusRef = statusDoc._id;
    await savedOrder.save();

    // Clear cart after placing order
    await Cart.deleteMany({ userEmail });

    res.json({ msg: "✅ Order placed successfully!", order: savedOrder });
  } catch (err) {
    console.error("❌ Checkout order error:", err);
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
    res.json({ msg: "🗑️ Order deleted successfully" });
  } catch (err) {
    console.error("❌ Delete order error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
