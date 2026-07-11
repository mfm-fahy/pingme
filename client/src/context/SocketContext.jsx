import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [lastMessage, setLastMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [messagesRead, setMessagesRead] = useState(null);

  useEffect(() => {
    if (!token || !user) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('getOnlineUsers');
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('onlineUsers', (userIds) => {
      setOnlineUserIds(new Set(userIds));
    });

    socket.on('userOnline', ({ userId }) => {
      setOnlineUserIds((prev) => new Set([...prev, userId]));
    });

    socket.on('userOffline', ({ userId }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    socket.on('newMessage', (message) => {
      setLastMessage(message);
    });

    socket.on('userTyping', ({ userId }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: true }));
    });

    socket.on('userStoppedTyping', ({ userId }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on('messagesRead', ({ by }) => {
      setMessagesRead({ by, timestamp: Date.now() });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  const sendMessage = useCallback((receiverId, text, replyTo = null) => {
    if (socketRef.current) {
      socketRef.current.emit('sendMessage', { receiverId, text, replyTo });
    }
  }, []);

  const markRead = useCallback((userId) => {
    if (socketRef.current) {
      socketRef.current.emit('markRead', { userId });
    }
  }, []);

  const sendTyping = useCallback((receiverId) => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { receiverId });
    }
  }, []);

  const sendStopTyping = useCallback((receiverId) => {
    if (socketRef.current) {
      socketRef.current.emit('stopTyping', { receiverId });
    }
  }, []);

  const refreshOnlineUsers = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('getOnlineUsers');
    }
  }, []);

  return (
    <SocketContext.Provider value={{
      isConnected,
      onlineUserIds,
      lastMessage,
      typingUsers,
      messagesRead,
      sendMessage,
      markRead,
      sendTyping,
      sendStopTyping,
      refreshOnlineUsers,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
}
