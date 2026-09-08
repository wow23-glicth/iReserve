import { useEffect, useRef } from 'react';
import { LayoutDashboard, Package, Coins, CalendarDays, ChartNoAxesCombined, Settings2, LogOut, X, ArrowUpRight } from 'lucide-react';
interface SidebarProps {
  page: string; role: string; setPage: (page: string) => void;
  onLogout: () => void; isOpen: boolean; onClose: () => void;
}
const links = [
  { page: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'products', label: 'Inventory', icon: Package },
  { page: 'sales', label: 'Sales', icon: Coins },
  { page: 'reservations', label: 'Reservations', icon: CalendarDays },
  { page: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
];
export default function Sidebar({ page, role, setPage, onLogout, isOpen, onClose }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Wait for the drawer's visibility style before moving keyboard focus.
    const focusFrame = requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus());
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      const buttons = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button') || []).filter(el => el.getClientRects().length);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { cancelAnimationFrame(focusFrame); document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [isOpen]);
  const navigate = (next: string) => { setPage(next); onClose(); };
  return <>
    <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} aria-hidden="true" />
    <aside ref={sidebarRef} className={`sidebar ${isOpen ? 'open' : ''}`} id="main-navigation" aria-label="Main navigation">
      <button type="button" className="sidebar-close icon-button" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
      <div className="sidebar-brand"><img src="/logo2.png" alt="PJP Hardware logo" width="64" height="64" /><strong>PJP HARDWARE</strong><span>Inventory Management</span></div>
      <nav className="nav-menu" aria-label="Workspace">
        {links.filter(item => item.page !== 'products' || ['Admin', 'Manager'].includes(role)).map(item => <button type="button" key={item.page} className={`nav-link ${page === item.page ? 'active' : ''}`} aria-current={page === item.page ? 'page' : undefined} onClick={() => navigate(item.page)}><item.icon size={19} /><span>{item.label}</span>{page === item.page && <span className="nav-active-dot" />}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><ArrowUpRight size={19} /><p>Built for your<br /><strong>everyday business.</strong></p></div>
        {role === 'Admin' && <button type="button" className={`nav-link ${page === 'users' ? 'active' : ''}`} aria-current={page === 'users' ? 'page' : undefined} onClick={() => navigate('users')}><Settings2 size={18} /><span>User Settings</span></button>}
        <button type="button" className="nav-link logout-link" onClick={() => { onLogout(); onClose(); }}><LogOut size={18} /><span>Log out</span></button>
        <p className="sidebar-footer">PJP Hardware · Workspace</p>
      </div>
    </aside>
  </>;
}
