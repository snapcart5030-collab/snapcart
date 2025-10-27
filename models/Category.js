// models/Category.js
const mongoose = require('mongoose');

// Product schema (embedded inside subcategories)
const ProductSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productDisc: String,
  productImage: String,
}, { _id: true });

// Subcategory schema
const SubcategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  products: [ProductSchema]
}, { _id: true });

// Category schema
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  subcategories: [SubcategorySchema]
}, { timestamps: true });

// 👇 इथे collection नाव स्पष्ट दिलंय
module.exports = mongoose.model('Category', CategorySchema, 'categories');
