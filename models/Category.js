// models/Category.js
const mongoose = require('mongoose');

// Product schema (embedded inside subcategories)
const ProductSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productDisc: String,
  productImage: String,
}, { _id: true }); // auto _id for each product

// Subcategory schema (e.g. Mango, Banana)
const SubcategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  products: [ProductSchema]
}, { _id: true });

// Category schema (e.g. Fruits)
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  subcategories: [SubcategorySchema]
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
