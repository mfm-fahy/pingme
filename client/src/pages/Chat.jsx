import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import UserList from '../components/UserList';
import ChatWindow from '../components/ChatWindow';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Chat() {
  const { user, token, logout } = useAuth();
  const { isConnected, lastMessage, refreshOnlineUsers } = useSocket();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showSidebar, setShowSidebar] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);

      // Fetch unread counts
      const counts = {};
      for (const u of res.data) {
        try {
          const countRes = await axios.get(`${API_URL}/api/messages/unread/${u._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (countRes.data.count > 0) {
            counts[u._id] = countRes.data.count;
          }
        } catch (e) {}
      }
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    refreshOnlineUsers();
    const interval = setInterval(() => {
      fetchUsers();
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (lastMessage && selectedUser) {
      const otherUserId =
        lastMessage.sender._id === user._id
          ? lastMessage.receiver._id
          : lastMessage.sender._id;

      if (otherUserId === selectedUser._id && lastMessage.sender._id !== user._id) {
        setUnreadCounts((prev) => {
          const next = { ...prev };
          delete next[selectedUser._id];
          return next;
        });
      }
    }

    if (lastMessage) {
      const senderId = lastMessage.sender._id;
      const receiverId = lastMessage.receiver._id;
      if (senderId !== user._id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1,
        }));
      }
    }
  }, [lastMessage, selectedUser, user]);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[u._id];
      return next;
    });
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleBack = () => {
    setShowSidebar(true);
    setSelectedUser(null);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="chat-app">
      <div className={`chat-sidebar ${showSidebar ? 'active' : ''} ${selectedUser ? 'has-selection' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <div className="user-avatar-small">{user.username[0].toUpperCase()}</div>
            <span className="sidebar-username">{user.username}</span>
          </div>
          <div className="sidebar-header-right">
            <div className={`connection-dot ${isConnected ? 'connected' : ''}`} title={isConnected ? 'Connected' : 'Disconnected'} />
            <button className="btn-icon" onClick={handleLogout} title="Logout">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
        <UserList
          users={users}
          selectedUser={selectedUser}
          onSelect={handleSelectUser}
          unreadCounts={unreadCounts}
        />
      </div>
      <div className={`chat-main ${!showSidebar || selectedUser ? 'active' : ''}`}>
        {selectedUser ? (
          <ChatWindow
            selectedUser={selectedUser}
            onBack={handleBack}
          />
        ) : (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg width="80" height="80" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#dc3545" opacity="0.1"/>
                <path d="M34.6 13.4C31.5 10.3 27.4 8.5 23 8.5c-9.1 0-16.5 7.4-16.5 16.5 0 2.9.8 5.8 2.2 8.3L8.5 39.5l6.4-1.7c2.4 1.3 5.1 2 7.8 2h.1c9.1-.1 16.5-7.5 16.5-16.6 0-4.4-1.7-8.5-4.7-11.6z" fill="#dc3545" opacity="0.3"/>
              </svg>
            </div>
            <h2>PingMe Web</h2>
            <p>Send and receive messages in real-time.<br/>Select a user to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
}
