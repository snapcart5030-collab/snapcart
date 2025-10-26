// models/Cart.js
const mongoose = require('mongoose'); // <-- Add this line

const CartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true }, // store product _id as string
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productImage: { type: String},
  quantity: { type: Number, default: 1 }
}, { _id: false });

const CartSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  items: [CartItemSchema],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Cart', CartSchema);
