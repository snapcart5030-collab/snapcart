// routes/register.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// ✅ Direct Register (no OTP)
router.post("/", async (req, res) => {
  try {
    const { username, email, password, mobile } = req.body;

    if (!username || !email || !password || !mobile) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // create and save new user
    const newUser = new User({
      username,
      email,
      password: hashed,
      mobile,
    });

    await newUser.save();

    console.log(`✅ New user registered: ${email}`);
    res.json({ msg: "Registration successful" });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
