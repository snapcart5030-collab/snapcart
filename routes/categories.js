const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// ✅ Create category (no change, just safer)
router.post('/', async (req, res) => {
  try {
    const { name, description, subcategories } = req.body;
    const existing = await Category.findOne({ name }).lean();
    if (existing) return res.status(400).json({ msg: 'Category already exists' });

    const category = new Category({
      name,
      description,
      subcategories: subcategories || [],
    });

    await category.save();
    res.json(category);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Get all categories (lightweight)
router.get('/', async (req, res) => {
  try {
    // फक्त basic फील्ड्स आणा — संपूर्ण products लोड करू नका
    const categories = await Category.find({}, { name: 1, description: 1, 'subcategories.name': 1 }).lean();
    res.json(categories);
  } catch (err) {
    console.error('Get all categories error:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Get only subcategories of a specific category
router.get('/:category/subcategories', async (req, res) => {
  try {
    const catName = req.params.category;
    const category = await Category.findOne(
      { name: new RegExp(`^${catName}$`, 'i') },
      { 'subcategories.name': 1, 'subcategories.description': 1, name: 1 }
    ).lean();

    if (!category) return res.status(404).json({ msg: 'Category not found' });

    const subs = category.subcategories.map((sub) => ({
      name: sub.name,
      description: sub.description,
    }));

    res.json({
      category: category.name,
      subcategories: subs,
    });
  } catch (err) {
    console.error('Get subcategories error:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Get single category (with all subcategories + products)
router.get('/:category', async (req, res) => {
  try {
    const catName = req.params.category;
    const category = await Category.findOne(
      { name: new RegExp(`^${catName}$`, 'i') }
    ).lean();

    if (!category) return res.status(404).json({ msg: 'Category not found' });
    res.json(category);
  } catch (err) {
    console.error('Get single category error:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Get products inside specific subcategory
router.get('/:category/:subcategory', async (req, res) => {
  try {
    const { category, subcategory } = req.params;

    const cat = await Category.findOne(
      { name: new RegExp(`^${category}$`, 'i') },
      { subcategories: { $elemMatch: { name: new RegExp(`^${subcategory}$`, 'i') } } }
    ).lean();

    if (!cat) return res.status(404).json({ msg: 'Category not found' });
    if (!cat.subcategories || !cat.subcategories[0])
      return res.status(404).json({ msg: 'Subcategory not found' });

    res.json(cat.subcategories[0].products || []);
  } catch (err) {
    console.error('Get subcategory products error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
