// routes/products.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middlewares/auth');

// Create product (admin or any authorized caller)
router.post('/', auth, async (req, res) => {
  try {
    const {
      productName,
      productPrice,
      productDisc,
      productImage,
      productStack,
      productIcon,
      productQuantity,
      category,
      subcategory
    } = req.body;

    const prod = new Product({
      productName,
      productPrice,
      productDisc,
      productImage,
      productStack,
      productIcon,
      productQuantity: productQuantity ?? 1,
      category,
      subcategory
    });

    await prod.save();
    res.json(prod);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get all products — e.g., GET http://localhost:5010/snapcartproducts
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get single product by id
router.get('/:id', async (req, res) => {
  try {
    const prod = await Product.findById(req.params.id);
    if (!prod) return res.status(404).json({ msg: 'Product Not found' });
    res.json(prod);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update product
router.put('/:id', auth, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Delete product (permanent)
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Product deleted' });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
