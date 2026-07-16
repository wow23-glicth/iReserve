import React from 'react';
import { Calendar, Shield, Menu } from 'lucide-react';

interface HeaderProps {
  page: string;
  userName: string;
  role: string;
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ page, userName, role, onToggleSidebar }) => {
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

  return (
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

      {/* Right Side: Date and Profile */}
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <Calendar size={14} />
          <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

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
  );
};

export default Header;
