const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  username: { type: String },
  email: { type: String, required: true },
  textMessage: { type: String, required: true },
  responses: [
    {
      message: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  seenBy: [String], // Track who has seen the message
  hiddenForUsers: [String], // Soft delete
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Contact", ContactSchema);
