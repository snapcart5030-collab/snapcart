const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Category = require("../models/Category");
const auth = require("../middlewares/auth");

// ✅ Helper to find a product across categories/subcategories
async function findProductById(productId) {
  const categories = await Category.find();
  for (const cat of categories) {
    for (const sub of cat.subcategories || []) {
      const found = sub.products?.find(
        (p) => p._id.toString() === productId.toString()
      );
      if (found) return found;
    }
  }
  return null;
}

// ✅ Get current user's cart
router.get("/", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userEmail: req.user.email });
    res.json(cart || { userEmail: req.user.email, items: [] });
  } catch (err) {
    console.error("Cart fetch error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Add to cart (optimized)
router.post("/add", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Math.max(1, parseInt(quantity) || 1);

    if (!productId)
      return res.status(400).json({ msg: "ProductId is required" });

    const product = await findProductById(productId);
    if (!product) return res.status(404).json({ msg: "Product not found" });

    let cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) cart = new Cart({ userEmail: req.user.email, items: [] });

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

    cart.markModified("items");
    cart.updatedAt = new Date();
    await cart.save();

    // ✅ Return updated cart directly for instant UI sync
    res.json(cart);
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Remove / decrement quantity (safe & instant)
router.post("/remove", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Math.max(1, parseInt(quantity) || 1);

    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.status(400).json({ msg: "Cart not found" });

    const idx = cart.items.findIndex((i) => i.productId === productId);
    if (idx === -1)
      return res.status(404).json({ msg: "Product not found in cart" });

    cart.items[idx].quantity -= qty;
    if (cart.items[idx].quantity <= 0) cart.items.splice(idx, 1);

    cart.markModified("items");
    cart.updatedAt = new Date();
    await cart.save();

    res.json(cart);
  } catch (err) {
    console.error("Remove cart error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Delete specific item
router.delete("/item/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.status(400).json({ msg: "Cart not found" });

    cart.items = cart.items.filter((i) => i.productId !== productId);
    cart.markModified("items");
    cart.updatedAt = new Date();
    await cart.save();

    res.json(cart);
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ✅ Clear all items
router.post("/clear", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.json({ msg: "Cart already empty" });

    cart.items = [];
    cart.markModified("items");
    await cart.save();

    res.json({ msg: "Cart cleared" });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
