const express = require('express');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user._id;
    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: userId },
        { sender: userId, receiver: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender', 'username')
      .populate('receiver', 'username');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/unread/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await Message.countDocuments({
      sender: userId,
      receiver: req.user._id,
      read: false,
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/read/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    await Message.updateMany(
      { sender: userId, receiver: req.user._id, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
