require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://pingme-v1.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store online users: userId -> socketId
const onlineUsers = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error('User not found'));
    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.username} (${socket.userId})`);
  onlineUsers.set(socket.userId, socket.id);

  await User.findByIdAndUpdate(socket.userId, { online: true });

  io.emit('userOnline', { userId: socket.userId, username: socket.username });

  socket.on('getOnlineUsers', async () => {
    const users = await User.find({
      _id: { $ne: socket.userId },
      online: true,
    }).select('username online lastSeen');
    socket.emit('onlineUsers', users.map(u => u._id.toString()));
  });

  socket.on('sendMessage', async (data, callback) => {
    try {
      const message = new Message({
        sender: socket.userId,
        receiver: data.receiverId,
        text: data.text,
      });
      await message.save();

      const populated = await Message.findById(message._id)
        .populate('sender', 'username')
        .populate('receiver', 'username');

      // Send to sender
      socket.emit('newMessage', populated);

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', populated);
      }

      if (callback) callback({ success: true, message: populated });
    } catch (error) {
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on('markRead', async (data) => {
    try {
      await Message.updateMany(
        { sender: data.userId, receiver: socket.userId, read: false },
        { read: true }
      );
      const readerSocketId = onlineUsers.get(data.userId);
      if (readerSocketId) {
        io.to(readerSocketId).emit('messagesRead', { by: socket.userId });
      }
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  socket.on('typing', (data) => {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', {
        userId: socket.userId,
        username: socket.username,
      });
    }
  });

  socket.on('stopTyping', (data) => {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userStoppedTyping', {
        userId: socket.userId,
      });
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.username} (${socket.userId})`);
    onlineUsers.delete(socket.userId);
    await User.findByIdAndUpdate(socket.userId, {
      online: false,
      lastSeen: new Date(),
    });
    io.emit('userOffline', { userId: socket.userId });
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

module.exports = { app, server, io };
