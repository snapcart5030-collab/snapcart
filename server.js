require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const orderDeliveryRoutes = require("./routes/orderDelivery");

const app = express();
const server = http.createServer(app);

// ===================== CORS =====================
const allowedOrigins = [
  "http://localhost:5030",
  "https://snapcart-usja.onrender.com", 
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

// ===================== Socket.io Setup =====================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

// ===================== MongoDB =====================
connectDB();

// ✅ Make io available globally (optional for routes)
app.set("io", io);

// ✅ Import routes after io initialized
const deliveryProgressRoutes = require("./routes/deliveryProgress")(io);

try {
  app.use("/auth", require("./routes/auth"));
  app.use("/snapcartproducts", require("./routes/products"));
  app.use("/snapcartcategories", require("./routes/categories"));
  app.use("/cart", require("./routes/cart"));
  app.use("/orders", require("./routes/orders"));
  app.use("/orderdelivery", orderDeliveryRoutes);
  app.use("/orderstatus", require("./routes/orderStatus")(io, new Map()));
  app.use("/contact", require("./routes/contact"));
  app.use("/api/likes", require("./routes/likes"));
  app.use("/api/otp", require("./routes/registerOtp"));
  app.use("/deliveryprogress", deliveryProgressRoutes);
  console.log("✅ Routes mounted successfully.");
} catch (err) {
  console.error("❌ Error mounting routes:", err);
}

// ===================== SOCKET.IO CHAT LOGIC =====================
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // ✅ Register user by email
  socket.on("register", (email) => {
    if (email) {
      onlineUsers.set(email, socket.id);
      console.log(`✅ Registered: ${email} -> ${socket.id}`);
    }
  });

  // ✅ Real-time send/receive message between user & admin
  socket.on("sendMessage", (data) => {
    const { sender, receiver, message, contactId } = data;
    const receiverSocketId = onlineUsers.get(receiver);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", {
        sender,
        receiver,
        message,
        contactId,
      });
      console.log(`📩 Message sent from ${sender} to ${receiver}`);
    } else {
      console.log(`⚠️ Receiver (${receiver}) is offline`);
    }
  });

  // ✅ Typing indicator
  socket.on("typing", (data) => {
    const { sender, receiver } = data;
    const receiverSocketId = onlineUsers.get(receiver);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { sender, receiver });
    }
  });

  // ✅ Handle user disconnect
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
    for (let [email, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(email);
        io.emit("userDisconnected", { email });
        console.log(`❌ Removed ${email} (offline)`);
        break;
      }
    }
  });
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 5030;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
