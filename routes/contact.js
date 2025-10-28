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

    // ✅ Emit socket event to admin in realtime
    const io = req.app.get("io");
    io.emit("receiveMessage", {
      sender: email,
      email,
      username,
      message: textMessage,
      contactId: msg._id,
    });

    res.json({ msg: "Message sent successfully", data: msg });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// 📥 USER FETCH MESSAGES
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

    // ✅ Emit socket to specific user (if online)
    const io = req.app.get("io");
    io.emit("receiveMessage", {
      sender: "admin@gmail.com",
      receiver: contact.email,
      message,
      contactId: contact._id,
    });

    res.json({ msg: "Reply added", data: contact });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});
