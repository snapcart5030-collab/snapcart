const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Avoid multiple connections (Render मध्ये हे खूप महत्वाचं आहे)
    if (mongoose.connection.readyState >= 1) {
      console.log("⚡ MongoDB already connected");
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10, // ✅ अधिक concurrency handle करण्यासाठी
      serverSelectionTimeoutMS: 8000, // ✅ MongoDB server slow असल्यास लवकर fail होईल
      socketTimeoutMS: 45000, // ✅ Long-running queries साठी timeout
      connectTimeoutMS: 10000, // ✅ Render cold start साठी सुरक्षित timeout
    });

    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message || err);
    // Retry logic (useful on Render cold starts)
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
