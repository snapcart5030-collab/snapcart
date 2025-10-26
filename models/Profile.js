// models/Profile.js
const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  username: String,
  email: { type: String, required: true },
  mobile: String
});

module.exports = mongoose.model('Profile', ProfileSchema);
