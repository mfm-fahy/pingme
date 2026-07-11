import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ChatWindow({ selectedUser, onBack }) {
  const { user, token } = useAuth();
  const { sendMessage, markRead, sendTyping, sendStopTyping, onlineUserIds, lastMessage, typingUsers, messagesRead } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const containerRef = useRef(null);

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
    sendMessage(selectedUser._id, text);
    setInput('');
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
            return (
              <div key={msg._id} className={`message ${isMine ? 'sent' : 'received'}`}>
                <div className="message-bubble">
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

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message"
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
