import { useSocket } from '../context/SocketContext';

export default function UserList({ users, selectedUser, onSelect, unreadCounts }) {
  const { onlineUserIds } = useSocket();

  return (
    <div className="user-list">
      <div className="user-list-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" placeholder="Search or start new chat" className="search-input" id="userSearch"
          onInput={(e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.user-item').forEach((item) => {
              const name = item.dataset.username || '';
              item.style.display = name.toLowerCase().includes(query) ? '' : 'none';
            });
          }}
        />
      </div>
      <div className="user-list-items">
        {users.length === 0 && (
          <div className="user-list-empty">No users yet. Share the app with friends!</div>
        )}
        {users.map((u) => {
          const isOnline = onlineUserIds.has(u._id);
          const isSelected = selectedUser?._id === u._id;
          const unread = unreadCounts[u._id] || 0;
          return (
            <div
              key={u._id}
              className={`user-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(u)}
              data-username={u.username}
            >
              <div className="user-avatar">
                <span>{u.username[0].toUpperCase()}</span>
                <div className={`online-indicator ${isOnline ? 'online' : ''}`} />
              </div>
              <div className="user-info">
                <div className="user-info-top">
                  <span className="user-name">{u.username}</span>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                </div>
                <span className={`user-status ${isOnline ? 'online' : ''}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
