const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// ✅ Create category (same logic, with validation and async safety)
router.post('/', async (req, res) => {
  try {
    const { name, description, subcategories } = req.body;

    if (!name) return res.status(400).json({ msg: 'Category name required' });

    const existing = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (existing) return res.status(400).json({ msg: 'Category already exists' });

    const category = new Category({
      name: name.trim(),
      description: description?.trim() || '',
      subcategories: subcategories || [],
    });

    await category.save();
    res.json(category);
  } catch (err) {
    console.error('❌ Create category error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Get all categories (only lightweight fields)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find(
      {},
      { name: 1, description: 1, 'subcategories.name': 1 }
    )
      .lean()
      .sort({ name: 1 }); // sorted alphabetically for consistency

    res.json(categories);
  } catch (err) {
    console.error('❌ Get all categories error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Get only subcategories of a specific category
router.get('/:category/subcategories', async (req, res) => {
  try {
    const catName = req.params.category.trim();
    const category = await Category.findOne(
      { name: new RegExp(`^${catName}$`, 'i') },
      { 'subcategories.name': 1, 'subcategories.description': 1, name: 1 }
    ).lean();

    if (!category)
      return res.status(404).json({ msg: 'Category not found' });

    const subs = (category.subcategories || []).map((sub) => ({
      name: sub.name,
      description: sub.description,
    }));

    res.json({
      category: category.name,
      subcategories: subs,
    });
  } catch (err) {
    console.error('❌ Get subcategories error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Get full category with subcategories + products
router.get('/:category', async (req, res) => {
  try {
    const catName = req.params.category.trim();
    const category = await Category.findOne({
      name: new RegExp(`^${catName}$`, 'i'),
    }).lean();

    if (!category)
      return res.status(404).json({ msg: 'Category not found' });

    res.json(category);
  } catch (err) {
    console.error('❌ Get single category error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Get products inside specific subcategory (more precise query)
router.get('/:category/:subcategory', async (req, res) => {
  try {
    const { category, subcategory } = req.params;

    const cat = await Category.findOne(
      { name: new RegExp(`^${category.trim()}$`, 'i') },
      { subcategories: { $elemMatch: { name: new RegExp(`^${subcategory.trim()}$`, 'i') } } }
    ).lean();

    if (!cat)
      return res.status(404).json({ msg: 'Category not found' });
    if (!cat.subcategories?.length)
      return res.status(404).json({ msg: 'Subcategory not found' });

    res.json(cat.subcategories[0].products || []);
  } catch (err) {
    console.error('❌ Get subcategory products error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
