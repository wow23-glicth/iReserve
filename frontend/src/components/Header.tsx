import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, Shield, Cpu, Package, Coins, BarChart3, Users, CornerDownLeft, Menu } from 'lucide-react';

interface HeaderProps {
  page: string;
  userName: string;
  role: string;
  setPage: (page: string) => void;
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ page, userName, role, setPage, onToggleSidebar }) => {
  const [showPalette, setShowPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const paletteRef = useRef<HTMLDivElement>(null);

  const getPageTitle = (p: string) => {
    switch (p) {
      case 'home':
        return 'System Overview';
      case 'products':
        return 'Inventory Management';
      case 'sales':
        return 'Sales Operations';
      case 'reservations':
        return 'Reservation Management';
      case 'analytics':
        return 'Business Analytics';
      case 'users':
        return 'User Settings';
      default:
        return p;
    }
  };

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close palette on clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowPalette(false);
      }
    };
    if (showPalette) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPalette]);

  const navOptions = [
    { label: 'Go to Dashboard', icon: <Cpu size={16} />, action: () => setPage('home') },
    { label: 'Go to Inventory', icon: <Package size={16} />, action: () => setPage('products') },
    { label: 'Go to Sales', icon: <Coins size={16} />, action: () => setPage('sales') },
    { label: 'Go to Reservations', icon: <Calendar size={16} />, action: () => setPage('reservations') },
    { label: 'Go to Analytics', icon: <BarChart3 size={16} />, action: () => setPage('analytics') },
    { label: 'Go to User Settings', icon: <Users size={16} />, action: () => setPage('users') }
  ];

  const filteredOptions = navOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="page-header" style={{ position: 'relative' }}>
        {/* Left Side: Page Title + Mobile Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            className="sidebar-hamburger" 
            onClick={onToggleSidebar}
            style={{
              padding: '0.45rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.45)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            <Menu size={18} />
          </button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {getPageTitle(page)}
          </h2>
        </div>

        {/* Center: Search Bar (Pill design) */}
        <div 
          onClick={() => setShowPalette(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.45)',
            border: '1px solid var(--border-color)',
            borderRadius: '100px',
            padding: '0.45rem 1.25rem',
            width: '280px',
            cursor: 'pointer',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.02)'
          }}
          className="search-bar-mock"
        >
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>Search...</span>
        </div>

        {/* Right Side: Date, Notification, Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Current Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <Calendar size={14} />
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>


          {/* User Profile Info */}
          <div className="user-profile">
            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="user-info-text" style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column' }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{userName}</strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Shield size={10} /> {role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── COMMAND PALETTE MODAL (Ctrl + K) ── */}
      {showPalette && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '15vh' }}>
          <div 
            ref={paletteRef} 
            className="modal-content glass-panel" 
            style={{ 
              maxWidth: '520px', 
              padding: '0', 
              overflow: 'hidden', 
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.15)'
            }}
          >
            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '1.25rem', borderBottom: '1px solid var(--border-color)', gap: '0.75rem' }}>
              <Search size={20} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Type to search sections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  flex: 1
                }}
                autoFocus
              />
              <kbd style={{
                fontSize: '0.75rem',
                background: 'rgba(0, 0, 0, 0.05)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace'
              }}>ESC</kbd>
            </div>

            {/* Options List */}
            <div style={{ padding: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.5rem 0.75rem', letterSpacing: '0.04em' }}>
                Navigation Shortcuts
              </p>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      opt.action();
                      setShowPalette(false);
                      setSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      gap: '0.75rem',
                      transition: 'all 0.15s ease',
                      justifyContent: 'space-between'
                    }}
                    className="palette-item"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--primary)' }}>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Select <CornerDownLeft size={10} />
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
                  No sections found matching "{searchQuery}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
