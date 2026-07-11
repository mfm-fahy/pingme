import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SWIPE_THRESHOLD = 80;

export default function ChatWindow({ selectedUser, onBack }) {
  const { user, token } = useAuth();
  const { sendMessage, markRead, sendTyping, sendStopTyping, onlineUserIds, lastMessage, typingUsers, messagesRead } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [swipingId, setSwipingId] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0, id: null });

  const isOnline = onlineUserIds.has(selectedUser._id);
  const isTyping = typingUsers[selectedUser._id];

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/messages/${selectedUser._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(res.data);
        setTimeout(() => scrollToBottom('auto'), 50);
        markRead(selectedUser._id);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [selectedUser._id, token]);

  useEffect(() => {
    if (lastMessage) {
      const isRelevant =
        (lastMessage.sender._id === user._id && lastMessage.receiver._id === selectedUser._id) ||
        (lastMessage.sender._id === selectedUser._id && lastMessage.receiver._id === user._id);

      if (isRelevant) {
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === lastMessage._id);
          if (exists) return prev;
          return [...prev, lastMessage];
        });
        if (lastMessage.sender._id === selectedUser._id) {
          markRead(selectedUser._id);
        }
      }
    }
  }, [lastMessage, user._id, selectedUser._id]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (messagesRead?.by === selectedUser._id) {
      setMessages((prev) =>
        prev.map((m) =>
          m.sender._id === user._id && m.receiver._id === selectedUser._id
            ? { ...m, read: true }
            : m
        )
      );
    }
  }, [messagesRead, selectedUser._id, user._id]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage(selectedUser._id, text, replyTo?._id || null);
    setInput('');
    setReplyTo(null);
    sendStopTyping(selectedUser._id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    sendTyping(selectedUser._id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping(selectedUser._id);
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const cancelReply = () => setReplyTo(null);

  // Swipe-to-reply handlers
  const handleTouchStart = useCallback((e, msg) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, id: msg._id };
    setSwipingId(null);
    setSwipeX(0);
  }, []);

  const handleTouchMove = useCallback((e, msg) => {
    if (!touchStartRef.current.id) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // If vertical scroll is dominant, cancel swipe
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 20) return;

    if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      const clampedX = Math.min(dx, 160);
      setSwipingId(msg._id);
      setSwipeX(clampedX);
    }
  }, []);

  const handleTouchEnd = useCallback((e, msg) => {
    if (swipeX > SWIPE_THRESHOLD && swipingId === msg._id) {
      setReplyTo(msg);
    }
    setSwipingId(null);
    setSwipeX(0);
    touchStartRef.current = { x: 0, y: 0, id: null };
  }, [swipeX, swipingId]);

  // Long press handler (for devices without swipe)
  const longPressTimer = useRef(null);
  const handleLongPressStart = useCallback((msg) => {
    longPressTimer.current = setTimeout(() => {
      setReplyTo(msg);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  // Desktop: right-click reply
  const handleContextMenu = useCallback((e, msg) => {
    e.preventDefault();
    setReplyTo(msg);
  }, []);

  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = '';
    msgs.forEach((msg) => {
      const date = new Date(msg.createdAt).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ type: 'date', date, id: date });
      }
      groups.push({ type: 'message', message: msg, id: msg._id });
    });
    return groups;
  };

  const grouped = groupMessagesByDate(messages);

  const getReplyData = (replyTo) => {
    if (!replyTo) return null;
    if (typeof replyTo === 'string') {
      const found = messages.find((m) => m._id === replyTo);
      return found || { text: 'Message', sender: { username: '' }, _id: replyTo };
    }
    if (replyTo.text) return replyTo;
    const found = messages.find((m) => m._id === replyTo._id);
    return found || { text: 'Message', sender: { username: '' }, _id: replyTo._id };
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button className="btn-back" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="chat-header-info">
          <div className={`user-avatar-header ${isOnline ? 'online-ring' : ''}`}>
            {selectedUser.username[0].toUpperCase()}
          </div>
          <div className="chat-header-text">
            <span className="chat-header-name">{selectedUser.username}</span>
            <span className={`chat-header-status ${isOnline ? 'online' : ''}`}>
              {isTyping ? (
                <span className="typing-text">typing...</span>
              ) : isOnline ? (
                <span className="status-online-text">online</span>
              ) : (
                `last seen ${new Date(selectedUser.lastSeen || Date.now()).toLocaleString('en-US', {
                  hour: '2-digit', minute: '2-digit', hour12: true,
                  month: 'short', day: 'numeric',
                })}`
              )}
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="btn-icon" title="Info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={containerRef}>
        {loading ? (
          <div className="chat-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="chat-no-messages">
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          grouped.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="date-separator">
                  <span>{item.date}</span>
                </div>
              );
            }
            const msg = item.message;
            const isMine = msg.sender._id === user._id;
            const isSwiping = swipingId === msg._id;
            const replyData = getReplyData(msg.replyTo);

            return (
              <div
                key={msg._id}
                className={`message ${isMine ? 'sent' : 'received'}`}
              >
                <div
                  className={`message-bubble ${isSwiping ? 'swiping' : ''}`}
                  style={isSwiping ? { transform: `translateX(${swipeX}px)`, transition: 'none' } : {}}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchMove={(e) => handleTouchMove(e, msg)}
                  onTouchEnd={(e) => handleTouchEnd(e, msg)}
                  onMouseDown={() => handleLongPressStart(msg)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  {replyData && (
                    <div className="message-reply-quote">
                      <div className="reply-quote-bar" />
                      <div className="reply-quote-content">
                        <span className="reply-quote-name">
                          {replyData.sender?._id === user._id
                            ? 'You'
                            : (typeof replyData.sender === 'object'
                                ? replyData.sender.username
                                : messages.find(m => m._id === msg.replyTo)?.sender?.username) || 'Unknown'}
                        </span>
                        <span className="reply-quote-text">
                          {replyData.text?.length > 60
                            ? replyData.text.substring(0, 60) + '...'
                            : replyData.text}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="message-text">{msg.text}</p>
                  <div className="message-meta">
                    <span className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit', hour12: true,
                      })}
                    </span>
                    {isMine && (
                      <span className={`message-status ${msg.read ? 'read' : ''}`}>
                        {msg.read ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="1 12 5 16 12 6"/>
                            <polyline points="7 12 11 16 18 6"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="5 12 10 17 20 7"/>
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {isSwiping && swipeX > 30 && (
                  <div className="swipe-reply-icon" style={{ opacity: Math.min((swipeX - 30) / 50, 1) }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 14 4 9 9 4"/>
                      <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })
        )}
        {isTyping && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className="reply-preview-bar">
          <div className="reply-preview-inner">
            <div className="reply-preview-bar-color" />
            <div className="reply-preview-content">
              <span className="reply-preview-name">
                {replyTo.sender?._id === user._id ? 'You' : (replyTo.sender?.username || 'Unknown')}
              </span>
              <span className="reply-preview-text">
                {replyTo.text?.length > 50
                  ? replyTo.text.substring(0, 50) + '...'
                  : replyTo.text}
              </span>
            </div>
            <button className="reply-preview-close" onClick={cancelReply}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          placeholder={replyTo ? 'Reply...' : 'Type a message'}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="chat-input"
          autoFocus
        />
        <button type="submit" className="btn-send" disabled={!input.trim()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
