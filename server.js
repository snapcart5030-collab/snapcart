require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// ===================== App Setup =====================
const app = express();
const server = http.createServer(app);

// ===================== MongoDB Connection =====================
connectDB()
  .then(() => console.log("✅ MongoDB ready"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ===================== Middlewares =====================
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json({ limit: "10mb" }));

// ===================== Socket.io Setup =====================
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
app.set("io", io);

// ===================== Online Users (Shared Map) =====================
const onlineUsers = new Map();

// ===================== Import Routes =====================
try {
  app.use("/auth", require("./routes/auth"));
  app.use("/snapcartproducts", require("./routes/products"));
  app.use("/snapcartcategories", require("./routes/categories"));
  app.use("/cart", require("./routes/cart"));

  // ✅ Fixed naming: should match `routes/order.js`
  app.use("/orders", require("./routes/orders")); // not "orders.js" plural

  // ✅ Order status & delivery progress
  app.use("/orderstatus", require("./routes/orderStatus")(io, onlineUsers));
  app.use("/orderdelivery", require("./routes/orderDelivery"));
  app.use("/deliveryprogress", require("./routes/deliveryProgress")(io));

  // ✅ Other routes
  app.use("/contact", require("./routes/contact"));
  app.use("/api/likes", require("./routes/likes"));
  app.use("/api/otp", require("./routes/registerOtp"));

  console.log("✅ All routes mounted successfully");
} catch (err) {
  console.error("❌ Error mounting routes:", err);
}

// ===================== Socket.IO Logic =====================
io.on("connection", (socket) => {
  console.log("🟢 New connection:", socket.id);

  socket.on("register", (email) => {
    if (email) {
      onlineUsers.set(email, socket.id);
      console.log(`✅ ${email} connected as ${socket.id}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    for (let [email, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(email);
        io.emit("userDisconnected", { email });
        break;
      }
    }
  });
});

// ===================== Health Route =====================
app.get("/health", (req, res) => res.send("✅ Server healthy"));

// ===================== Global Error Safety =====================
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

// ===================== Start Server =====================
const PORT = process.env.PORT || 5030;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
