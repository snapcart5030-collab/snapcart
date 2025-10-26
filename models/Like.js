const mongoose = require("mongoose");

const LikeSchema = new mongoose.Schema({
  username: String,
  email: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Like", LikeSchema);
