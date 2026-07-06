import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Coins, 
  Calendar, 
  BarChart3, 
  Users, 
  LogOut 
} from 'lucide-react';

interface SidebarProps {
  page: string;
  role: string;
  setPage: (page: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ page, role, setPage, onLogout, isOpen, onClose }) => {
  return (
    <>
      {/* Click-outside backdrop overlay */}
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Premium Frosted Glass Logo Area */}
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '0.75rem', 
            marginBottom: '2.5rem', 
            textAlign: 'center' 
          }}
        >
          <div 
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)'
            }}
            className="logo-container"
          >
            <img 
              src="/logo2.png" 
              alt="PJP Hardware Logo" 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                objectFit: 'cover'
              }} 
              className="logo-img"
            />
          </div>
          <div className="brand-name" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>PJP HARDWARE</span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 500 }}>Inventory Management</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-link ${page === 'home' ? 'active' : ''}`}
            onClick={() => { setPage('home'); onClose(); }}
          >
            <LayoutDashboard />
            <span className="nav-text">Dashboard</span>
          </button>

          <button 
            className={`nav-link ${page === 'products' ? 'active' : ''}`}
            onClick={() => { setPage('products'); onClose(); }}
          >
            <Package />
            <span className="nav-text">Inventory</span>
          </button>

          <button 
            className={`nav-link ${page === 'sales' ? 'active' : ''}`}
            onClick={() => { setPage('sales'); onClose(); }}
          >
            <Coins />
            <span className="nav-text">Sales</span>
          </button>

          <button 
            className={`nav-link ${page === 'reservations' ? 'active' : ''}`}
            onClick={() => { setPage('reservations'); onClose(); }}
          >
            <Calendar />
            <span className="nav-text">Reservations</span>
          </button>

          <button 
            className={`nav-link ${page === 'analytics' ? 'active' : ''}`}
            onClick={() => { setPage('analytics'); onClose(); }}
          >
            <BarChart3 />
            <span className="nav-text">Analytics</span>
          </button>

          <div style={{ margin: '1rem 0', borderTop: '1px solid rgba(255, 255, 255, 0.1)', opacity: 0.3 }} className="sidebar-divider"></div>

          <button 
            className={`nav-link ${page === 'users' ? 'active' : ''}`}
            onClick={() => { setPage('users'); onClose(); }}
            style={{ marginTop: 'auto' }}
          >
            <Users />
            <span className="nav-text">User Settings</span>
          </button>

          <button 
            className="nav-link danger"
            onClick={() => { onLogout(); onClose(); }}
          >
            <LogOut />
            <span className="nav-text">Logout</span>
          </button>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
