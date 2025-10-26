// routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const OrderStatus = require("../models/OrderStatus");
const auth = require("../middlewares/auth");
const axios = require("axios");

// ✅ Place a new order (Checkout)
// ✅ Place a new order (Checkout)
// ✅ Place a new order (Checkout)
 // top of file

// ✅ Place a new order (Checkout)
router.post("/checkout", auth, async (req, res) => {
  try {
    let { latitude, longitude, address } = req.body;

    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ msg: "Cart is empty" });

    const User = require("../models/User");
    const userDoc = await User.findOne({ email: req.user.email });

    // 🧠 Try to get human-readable address if only coordinates are passed
    if ((!address || address.startsWith("Lat")) && latitude && longitude) {
      try {
        const geo = await axios.get(
          `https://nominatim.openstreetmap.org/reverse`,
          {
            params: {
              lat: latitude,
              lon: longitude,
              format: "json",
            },
          }
        );
        address = geo.data.display_name || `Lat: ${latitude}, Lng: ${longitude}`;
      } catch {
        console.warn("Reverse geocode failed, using raw coordinates");
      }
    }

    // ✅ Final location: prefer new data, else use saved location
    const finalLocation =
      typeof latitude === "number" && typeof longitude === "number"
        ? { latitude, longitude, address, updatedAt: new Date() }
        : userDoc?.location || null;

    // ✅ Create order
    const products = cart.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      productImage: i.productImage,
      quantity: i.quantity,
      price: i.productPrice,
    }));

    const totalAmount = products.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0
    );

    const order = new Order({
      userEmail: req.user.email,
      username: req.user.username || "",
      mobile: req.user.mobile || "",
      products,
      totalAmount,
      status: "pending",
      location: finalLocation,
    });

    await order.save();

    const orderStatus = new OrderStatus({
      orderId: order._id.toString(),
      userEmail: req.user.email,
      status: "pending",
    });

    await orderStatus.save();

    order.statusRef = orderStatus._id;
    await order.save();

    cart.items = [];
    await cart.save();

    res.json({ msg: "Order placed successfully", order });
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).send("Server error during checkout");
  }
});

// ✅ Get all orders for the logged-in user
router.get("/myorders", auth, async (req, res) => {
  try {
    const orders = await Order.find({ userEmail: req.user.email })
      .populate("statusRef") // 🧩 include status info
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).send("Server error fetching orders");
  }
});

module.exports = router;
