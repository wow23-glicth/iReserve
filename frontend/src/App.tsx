import { useState, useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './views/Login';
const DashboardHome = lazy(() => import('./views/DashboardHome'));
const Inventory = lazy(() => import('./views/Inventory'));
const Sales = lazy(() => import('./views/Sales'));
const Reservations = lazy(() => import('./views/Reservations'));
const Analytics = lazy(() => import('./views/Analytics'));
const UserSettings = lazy(() => import('./views/UserSettings'));
import { clearEncryptionKeyCache } from './utils/crypto';

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
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userSession = await fetchProfile(session.user.id, session.user.email);
          setSession(userSession);
        }
      } catch (err) {
        console.error('Failed checking authentication session:', err);
      } finally {
        setLoading(false);
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
          clearEncryptionKeyCache();
          setPage('home');
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Helper function to check if page is allowed for a role
  const isPageAllowed = (pageName: string, userRole: string) => {
    if (userRole === 'Admin') return true;
    if (userRole === 'Manager') {
      return pageName !== 'users';
    }
    if (userRole === 'Cashier') {
      return ['home', 'sales', 'reservations', 'analytics'].includes(pageName);
    }
    return false;
  };

  // Redirect to home if user does not have permission for the current page
  useEffect(() => {
    if (session && !isPageAllowed(page, session.role)) {
      setPage('home');
    }
  }, [page, session]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setSession(null);
      clearEncryptionKeyCache();
      setPage('home');
    }
  };

  if (loading) return <div className="workspace-loader" role="status"><img src="/logo2.png" alt="PJP Hardware" /><Loader2 className="animate-spin" size={23} /><p>Opening your workspace…</p></div>;

  // Not authenticated? Show login page
  if (!session) {
    return <Login />;
  }

  // Helper render view function
  const renderView = () => {
    const activePage = isPageAllowed(page, session.role) ? page : 'home';
    switch (activePage) {
      case 'home':
        return <DashboardHome userName={session.user} role={session.role} onNavigate={setPage} />;
      case 'products':
        return <Inventory />;
      case 'sales':
        return <Sales role={session.role} />;
      case 'reservations':
        return <Reservations role={session.role} />;
      case 'analytics':
        return <Analytics />;
      case 'users':
        return <UserSettings />;
      default:
        return <DashboardHome userName={session.user} role={session.role} onNavigate={setPage} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        page={page}
        role={session.role}
        setPage={setPage}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <main className="main-content" id="workspace-content">
        <Header
          page={page}
          userName={session.user}
          role={session.role}
          sidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <div className="page-view" key={page}>
          <Suspense fallback={<div className="loading-state" role="status"><Loader2 className="animate-spin" size={26} /><span className="sr-only">Loading page</span></div>}>{renderView()}</Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
