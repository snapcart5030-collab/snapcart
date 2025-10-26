const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");

// 📨 USER SEND MESSAGE
router.post("/", async (req, res) => {
  try {
    const { username, email, textMessage } = req.body;
    if (!email || !textMessage)
      return res.status(400).json({ msg: "Email and message required" });

    const msg = new Contact({ username, email, textMessage });
    await msg.save();

    res.json({ msg: "Message saved", data: msg });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// 📥 USER FETCH MESSAGES (excluding deleted)
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const messages = await Contact.find({
      email,
      hiddenForUsers: { $ne: email },
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// 🧑‍💼 ADMIN FETCH ALL
router.get("/", async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// 💬 ADMIN REPLY
router.post("/:id/reply", async (req, res) => {
  try {
    const { message } = req.body;
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ msg: "Message not found" });

    contact.responses.push({ message });
    await contact.save();

    res.json({ msg: "Reply added", data: contact });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ❌ USER SOFT DELETE (single)
router.post("/:id/delete", async (req, res) => {
  try {
    const { email } = req.body;
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ msg: "Message not found" });

    if (!contact.hiddenForUsers.includes(email)) {
      contact.hiddenForUsers.push(email);
      await contact.save();
    }

    res.json({ msg: "Chat hidden for user", data: contact });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ❌ USER SOFT DELETE ALL
router.post("/deleteAll", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });

    await Contact.updateMany(
      { email, hiddenForUsers: { $ne: email } },
      { $push: { hiddenForUsers: email } }
    );

    res.json({ msg: "All messages hidden for user" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
