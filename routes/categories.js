const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// Create category
router.post('/', async (req, res) => {
  try {
    const { name, description, subcategories } = req.body;
    const existing = await Category.findOne({ name });
    if (existing) return res.status(400).json({ msg: 'Category already exists' });

    const category = new Category({
      name,
      description,
      subcategories: subcategories || []
    });

    await category.save();
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ✅ Get only subcategories of a specific category
router.get('/:category/subcategories', async (req, res) => {
  try {
    const catName = req.params.category;
    const category = await Category.findOne({ name: new RegExp(`^${catName}$`, 'i') });
    if (!category) return res.status(404).json({ msg: 'Category not found' });

    const subs = category.subcategories.map(sub => ({
      name: sub.name,
      description: sub.description
    }));

    res.json({
      category: category.name,
      subcategories: subs
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get single category (with all subcategories + products)
router.get('/:category', async (req, res) => {
  try {
    const catName = req.params.category;
    const category = await Category.findOne({ name: new RegExp(`^${catName}$`, 'i') });
    if (!category) return res.status(404).json({ msg: 'Category not found' });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ✅ Get products inside specific subcategory
router.get('/:category/:subcategory', async (req, res) => {
  try {
    const { category, subcategory } = req.params;
    const cat = await Category.findOne({ name: new RegExp(`^${category}$`, 'i') });
    if (!cat) return res.status(404).json({ msg: 'Category not found' });

    const sub = cat.subcategories.find(
      (s) => s.name.toLowerCase() === subcategory.toLowerCase()
    );
    if (!sub) return res.status(404).json({ msg: 'Subcategory not found' });

    res.json(sub.products || []);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
