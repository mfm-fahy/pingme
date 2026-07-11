import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onSwitch }) {
  const { signin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signin(username, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#dc3545"/>
              <path d="M34.6 13.4C31.5 10.3 27.4 8.5 23 8.5c-9.1 0-16.5 7.4-16.5 16.5 0 2.9.8 5.8 2.2 8.3L8.5 39.5l6.4-1.7c2.4 1.3 5.1 2 7.8 2h.1c9.1-.1 16.5-7.5 16.5-16.6 0-4.4-1.7-8.5-4.7-11.6z" fill="white"/>
              <path d="M20.2 16.2c-.4-1--.8-1-1.2-1-.3 0-.6 0-.9.3-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.1.2 2.2 3.4 5.4 4.7.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3l-2.7-1.2c-.2-.1-.4-.1-.6.1s-.8.9-.9 1.1c-.2.2-.3.2-.6.1-1.7-.8-2.8-1.5-4-3.4-.3-.5.3-.5.8-1.7l.4-.6c.2-.2.1-.5 0-.6l-1.2-2.7z" fill="#dc3545"/>
            </svg>
          </div>
          <h1>PingMe</h1>
          <p>Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="auth-footer">
          Don't have an account?{' '}
          <button className="btn-link" onClick={onSwitch}>Sign Up</button>
        </div>
      </div>
    </div>
  );
}
