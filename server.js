require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const Contact = require("./models/Contact");
const orderDeliveryRoutes = require("./routes/orderDelivery");

// ===================== App Setup =====================
const app = express();
const server = http.createServer(app);

// ===================== Socket.io Setup =====================
const io = new Server(server, {
  cors: {
    origin: "*", // सर्व domains allow करतो (test साठी)
    methods: ["GET", "POST"],
  },
});

// ✅ Now io exists — import routes that need it
const deliveryProgressRoutes = require("./routes/deliveryProgress")(io);

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ✅ Make io globally accessible
app.set("io", io);

// Log when routes mount (helpful for debugging)
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
  console.log("✅ Routes mounted.");
} catch (mountErr) {
  console.error("Error mounting routes:", mountErr);
}

// ===================== Socket.IO Logic =====================
const onlineUsers = new Map();

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
        console.log(`❌ Removed ${email} from online users`);
        io.emit("userDisconnected", { email });
        break;
      }
    }
  });
});

// ===================== Start Server =====================
const PORT = process.env.PORT || 5030;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
