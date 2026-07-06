import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { supabase } from './supabaseClient';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './views/Login';
import DashboardHome from './views/DashboardHome';
import Inventory from './views/Inventory';
import Sales from './views/Sales';
import Reservations from './views/Reservations';
import Analytics from './views/Analytics';
import UserSettings from './views/UserSettings';

interface UserSession {
  user: string;
  role: string;
  id: string;
  email?: string;
}

function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchProfile = async (userId: string, email?: string): Promise<UserSession | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error.message);
        return null;
      }

      if (data) {
        return {
          user: data.name,
          role: data.role,
          id: userId,
          email
        };
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
    return null;
  };

  // Check auth session on startup
  useEffect(() => {
    const initializeAuth = async () => {
      const startTime = Date.now();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userSession = await fetchProfile(session.user.id, session.user.email);
          setSession(userSession);
        }
      } catch (err) {
        console.error('Failed checking authentication session:', err);
      } finally {
        const elapsed = Date.now() - startTime;
        const minDuration = 2200; // 2.2s minimum delay
        const remaining = Math.max(0, minDuration - elapsed);
        setTimeout(() => {
          setLoading(false);
        }, remaining);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const userSession = await fetchProfile(session.user.id, session.user.email);
          setSession(userSession);
        } else {
          setSession(null);
          setPage('home');
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setSession(null);
      setPage('home');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #e3ece4 0%, #f4f7f4 50%, #e0ebe1 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Ambient Blobs in loading background */}
        <div className="bg-blobs">
          <div className="blob blob-1" style={{ top: '10%', right: '20%' }}></div>
          <div className="blob blob-2" style={{ bottom: '10%', left: '20%' }}></div>
        </div>

        {/* Cozy and Big Brand Preloader */}
        <div className="cozy-preloader-container">
          <div className="cozy-glow"></div>
          <div className="cozy-brand-wrapper">
            <img src="/logo2.png" alt="PJP Logo" className="cozy-logo" />
          </div>
          <h1 className="cozy-title">PJP HARDWARE</h1>
          <p className="cozy-subtitle">Setting up workspace...</p>
        </div>
      </div>
    );
  }

  // Not authenticated? Show login page
  if (!session) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // Helper render view function
  const renderView = () => {
    switch (page) {
      case 'home':
        return <DashboardHome />;
      case 'products':
        return <Inventory />;
      case 'sales':
        return <Sales />;
      case 'reservations':
        return <Reservations />;
      case 'analytics':
        return <Analytics />;
      case 'users':
        return <UserSettings />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="app-container">
      {/* Background Ambient Blobs for Glassmorphism pop */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <Sidebar 
        page={page} 
        role={session.role} 
        setPage={setPage} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="main-content">
        <Header 
          page={page} 
          userName={session.user} 
          role={session.role} 
          setPage={setPage}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />
        
        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default App;
