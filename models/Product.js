// models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productDisc: { type: String },
  productImage: { type: String }, // URL or base64
  productStack: { type: String },
  productIcon: { type: String },
  productQuantity: { type: Number, default: 1 }, // default 1
  category: { type: String, required: true }, // e.g., fruits
  subcategory: { type: String }, // e.g., tomato, potato
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
