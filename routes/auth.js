//routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Profile = require('../models/Profile');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require("../middlewares/auth");

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, mobile, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ msg: 'Missing fields' });

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    user = new User({ username, mobile, email, password: hashed });
    await user.save();

    // create profile document (if you use profile schema)
    try {
      const profile = new Profile({ username, email, mobile });
      await profile.save();
    } catch (profileErr) {
      // non-fatal: just log if profile fails
      console.warn('Profile creation failed:', profileErr.message || profileErr);
    }

    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { username, email, mobile } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Login (now accepts optional location fields)
router.post('/login', async (req, res) => {
  try {
    const { email, password, latitude, longitude, address } = req.body;
    if (!email || !password) return res.status(400).json({ msg: 'Missing fields' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // If client provided location, update user's location info
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      user.location = {
        latitude,
        longitude,
        address: address || user.location?.address || '',
        updatedAt: new Date()
      };
      try {
        await user.save();
      } catch (saveErr) {
        console.warn('Failed to save user location:', saveErr.message || saveErr);
      }
    }

    const payload = { id: user._id, email: user.email, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        location: user.location || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Logout (client can drop token; endpoint provided to optionally blacklist in future)
router.post('/logout', (req, res) => {
  // For now: let client delete token. If you want server blacklist, implement it.
  res.json({ msg: 'Logged out' });
});

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // req.user.id comes from decoded JWT
    const user = await User.findById(req.user.id).select("-password"); // exclude password
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json(user); // return all fields: username, email, mobile, location, etc.
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Optional: Update location endpoint (protected)
router.post('/location', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ msg: 'Invalid coordinates' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.location = {
      latitude,
      longitude,
      address: address || user.location?.address || '',
      updatedAt: new Date()
    };
    await user.save();

    res.json({ msg: 'Location updated', location: user.location });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
