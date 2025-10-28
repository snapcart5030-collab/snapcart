const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Category = require("../models/Category");
const auth = require("../middlewares/auth");

// Get current user's cart
router.get("/", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userEmail: req.user.email }).lean();
    res.json(cart || { userEmail: req.user.email, items: [] });
  } catch (err) {
    console.error("GET CART ERROR:", err);
    res.status(500).send("Server error");
  }
});

// Add item to cart
router.post("/add", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;
    if (!productId)
      return res.status(400).json({ msg: "ProductId is required" });

    // ✅ Fetch only matching product instead of all categories
    const category = await Category.findOne({
      "subcategories.products._id": productId,
    }).lean();

    if (!category) return res.status(404).json({ msg: "Product not found" });

    let product = null;
    for (const sub of category.subcategories) {
      const found = sub.products.find(
        (p) => p._id.toString() === productId.toString()
      );
      if (found) {
        product = found;
        break;
      }
    }

    if (!product) return res.status(404).json({ msg: "Product not found" });

    // ✅ Find or create user cart
    let cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) cart = new Cart({ userEmail: req.user.email, items: [] });

    // ✅ Update quantity or push new item
    const existing = cart.items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.items.push({
        productId: product._id.toString(),
        productName: product.productName,
        productPrice: product.productPrice,
        productImage: product.productImage,
        quantity: qty,
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    // ✅ Send only updated items (faster network response)
    res.json({ items: cart.items });
  } catch (err) {
    console.error("ADD CART ERROR:", err);
    res.status(500).send("Server error");
  }
});

// Remove or decrement quantity
router.post("/remove", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.status(400).json({ msg: "No cart found" });

    const idx = cart.items.findIndex((i) => i.productId === productId);
    if (idx === -1) return res.status(404).json({ msg: "Product not in cart" });

    cart.items[idx].quantity -= qty;
    if (cart.items[idx].quantity <= 0) {
      cart.items.splice(idx, 1);
    }

    cart.updatedAt = Date.now();
    await cart.save();
    res.json({ items: cart.items });
  } catch (err) {
    console.error("REMOVE CART ERROR:", err);
    res.status(500).send("Server error");
  }
});

// Delete a product from cart
router.delete("/item/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.status(400).json({ msg: "No cart found" });

    cart.items = cart.items.filter((i) => i.productId !== productId);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({ items: cart.items });
  } catch (err) {
    console.error("DELETE ITEM ERROR:", err);
    res.status(500).send("Server error");
  }
});

// Clear cart
router.post("/clear", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.json({ msg: "Cart already empty" });

    cart.items = [];
    await cart.save();
    res.json({ msg: "Cart cleared" });
  } catch (err) {
    console.error("CLEAR CART ERROR:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
