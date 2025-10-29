// models/Order.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: String,
  productImage: String,
  quantity: Number,
  price: Number
});

const OrderSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  username: { type: String },
  mobile: { type: String },
  products: [ProductSchema],
  totalAmount: Number,
  status: { type: String, default: "pending" },
  statusRef: { type: mongoose.Schema.Types.ObjectId, ref: "OrderStatus" },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String },
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
