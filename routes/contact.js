const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");

// 📨 USER SEND MESSAGE
router.post("/", async (req, res) => {
  try {
    const { username, email, textMessage } = req.body;
    if (!email || !textMessage)
      return res.status(400).json({ msg: "Email and message required" });

    // 🔹 Fast insert
    const msg = await Contact.create({ username, email, textMessage });

    res.json({ msg: "Message saved", data: msg });
  } catch (err) {
    console.error("❌ Contact Create Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

// 📥 USER FETCH MESSAGES (excluding deleted)
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // 🔹 Use lean() for performance
    const messages = await Contact.find({
      email,
      hiddenForUsers: { $ne: email },
    })
      .sort({ createdAt: 1 })
      .lean()
      .select("username email textMessage responses createdAt");

    res.json(messages);
  } catch (err) {
    console.error("❌ Fetch Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

// 🧑‍💼 ADMIN FETCH ALL
router.get("/", async (req, res) => {
  try {
    const messages = await Contact.find()
      .sort({ createdAt: -1 })
      .lean()
      .select("username email textMessage responses createdAt");

    res.json(messages);
  } catch (err) {
    console.error("❌ Admin Fetch Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

// 💬 ADMIN REPLY
router.post("/:id/reply", async (req, res) => {
  try {
    const { message } = req.body;

    // 🔹 Direct update (less blocking than find + save)
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { $push: { responses: { message } } },
      { new: true }
    );

    if (!contact) return res.status(404).json({ msg: "Message not found" });

    res.json({ msg: "Reply added", data: contact });
  } catch (err) {
    console.error("❌ Reply Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

// ❌ USER SOFT DELETE (single)
router.post("/:id/delete", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });

    // 🔹 Update in one query
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { hiddenForUsers: email } }, // add only if not exists
      { new: true }
    );

    if (!contact) return res.status(404).json({ msg: "Message not found" });

    res.json({ msg: "Chat hidden for user", data: contact });
  } catch (err) {
    console.error("❌ Delete Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

// ❌ USER SOFT DELETE ALL
router.post("/deleteAll", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });

    // 🔹 UpdateMany optimized
    await Contact.updateMany(
      { email, hiddenForUsers: { $ne: email } },
      { $addToSet: { hiddenForUsers: email } }
    );

    res.json({ msg: "All messages hidden for user" });
  } catch (err) {
    console.error("❌ DeleteAll Error:", err.message || err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
