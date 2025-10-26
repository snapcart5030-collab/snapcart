const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Category = require('../models/Category');
const auth = require('../middlewares/auth'); // your auth middleware

// Get current user's cart
router.get('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userEmail: req.user.email });
    res.json(cart || { userEmail: req.user.email, items: [] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Add item to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    if (!productId) return res.status(400).json({ msg: 'ProductId is required' });

    // Search product inside all categories/subcategories
    const categories = await Category.find();
    let product = null;

    outer: for (const cat of categories) {
      for (const sub of cat.subcategories) {
        if (!sub.products || !sub.products.length) continue;
        product = sub.products.find(p => p._id.toString() === productId);
        if (product) break outer;
      }
    }

    if (!product) return res.status(404).json({ msg: 'Product not found' });

    // Find or create cart
    let cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) cart = new Cart({ userEmail: req.user.email, items: [] });

    // Check if product already in cart
    const existing = cart.items.find(i => i.productId === productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.items.push({
        productId: product._id.toString(),
        productName: product.productName,
        productPrice: product.productPrice,
        productImage: product.productImage,
        quantity: qty
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();
    res.json(cart);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Remove or decrement quantity
router.post('/remove', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.status(400).json({ msg: 'No cart found' });

    const idx = cart.items.findIndex(i => i.productId === productId);
    if (idx === -1) return res.status(404).json({ msg: 'Product not in cart' });

    cart.items[idx].quantity -= qty;
    if (cart.items[idx].quantity <= 0) {
      cart.items.splice(idx, 1);
    }

    cart.updatedAt = Date.now();
    await cart.save();
    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Delete a product from cart
router.delete('/item/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.status(400).json({ msg: 'No cart found' });

    cart.items = cart.items.filter(i => i.productId !== productId);
    cart.updatedAt = Date.now();
    await cart.save();
    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Clear cart
router.post('/clear', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) return res.json({ msg: 'Cart already empty' });

    cart.items = [];
    await cart.save();
    res.json({ msg: 'Cart cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
