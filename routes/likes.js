const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const Like = require("../models/Like");

// ✅ Add Like (only once per user)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const { username, email } = req.user;

    // 🔹 Faster query — select only _id
    const existing = await Like.findOne({ email }).select("_id").lean();

    if (existing) {
      return res.status(400).json({ msg: "You already liked" });
    }

    // 🔹 Save asynchronously (non-blocking)
    await Like.create({ username, email, message });

    // 🔹 Send response immediately
    res.json({ msg: "Liked" });
  } catch (err) {
    console.error("❌ Like Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

// ✅ Get current user's like status
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // 🔹 Use lean() for faster response
    const existing = await Like.findOne({ email: req.user.email })
      .select("_id")
      .lean();

    res.json({ liked: !!existing });
  } catch (err) {
    console.error("❌ Like Fetch Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
