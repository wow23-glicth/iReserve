import React, { useState } from 'react';
import { ShieldCheck, UserCheck, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface LoginProps {
  onLoginSuccess?: (userData: { user: string; role: string }) => void;
}

const Login: React.FC<LoginProps> = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Allow users to input email OR simple username. 
      // Append '@ireserve.local' behind the scenes if it's a simple username.
      const email = username.includes('@') ? username.trim() : `${username.trim()}@ireserve.local`;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message || 'Invalid username or password.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure. Check if your Internet connection or Supabase project is active.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-panel" style={{ border: '1px solid rgba(255, 255, 255, 0.4)' }}>
        
        {/* Left Side: Frosted Hero Brand Area */}
        <div className="login-hero">
          <div 
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              marginBottom: '1.5rem'
            }}
          >
            <img 
              src="/logo2.png" 
              alt="PJP Hardware Logo" 
              style={{ 
                width: '90px', 
                height: '90px', 
                borderRadius: '50%', 
                objectFit: 'cover'
              }} 
            />
          </div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.4rem', color: 'white', letterSpacing: '0.04em' }}>
            PJP HARDWARE
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', fontWeight: 500, letterSpacing: '0.02em' }}>
            Inventory Management System
          </p>
        </div>

        {/* Right Side: Credentials Input */}
        <div className="login-form-container">
          <div style={{ marginBottom: '2rem' }}>
            <span style={{ 
              fontSize: '0.72rem', 
              color: 'var(--primary)', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginBottom: '0.5rem'
            }}>
              <ShieldCheck size={14} style={{ color: 'var(--primary)' }} /> Authorized Access Only
            </span>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>Terminal Sign In</h2>
          </div>

          {error && (
            <div className="ui-alert ui-alert-error" style={{ marginBottom: '1.5rem' }}>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="staffId">Staff Username / Email</label>
              <div style={{ position: 'relative' }}>
                <span style={{ 
                  position: 'absolute', 
                  left: '1rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <UserCheck size={18} />
                </span>
                <input 
                  id="staffId"
                  type="text" 
                  className="form-input" 
                  placeholder="Enter Username or Email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required 
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label" htmlFor="passcode">Access Passcode</label>
              <div style={{ position: 'relative' }}>
                <span style={{ 
                  position: 'absolute', 
                  left: '1rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <KeyRound size={18} />
                </span>
                <input 
                  id="passcode"
                  type="password" 
                  className="form-input" 
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center' }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Verifying Credentials...
                </>
              ) : (
                'Access Terminal'
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;
