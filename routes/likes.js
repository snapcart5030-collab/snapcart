const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const Like = require("../models/Like");

// ✅ Add Like (only once per user)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const { username, email } = req.user;

    // Check if user already liked
    const existing = await Like.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "You already liked" });
    }

    const newLike = new Like({ username, email, message });
    await newLike.save();

    res.json({ msg: "Like recorded successfully" });
  } catch (err) {
    console.error("❌ Like Error:", err);
    res.status(500).send("Server error");
  }
});

// ✅ Get current user's like status
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const existing = await Like.findOne({ email: req.user.email });
    res.json({ liked: !!existing });
  } catch (err) {
    console.error("❌ Like Fetch Error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
