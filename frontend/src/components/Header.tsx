import { CalendarDays, Menu } from 'lucide-react';

const pages: Record<string, [string, string]> = {
  home: ['Dashboard', 'Here’s what’s happening in your store today.'],
  products: ['Inventory Management', 'Keep track of your products, stock, and availability.'],
  sales: ['Sales Operations', 'Record sales, manage transactions, and reopen receipts.'],
  reservations: ['Reservation Management', 'Manage customer requests from reservation to collection.'],
  analytics: ['Business Analytics', 'A clearer picture of your store’s sales performance.'],
  users: ['User Settings', 'Manage your team and their access to the workspace.'],
};
interface HeaderProps {
  page: string; userName: string; role: string; sidebarOpen: boolean; onToggleSidebar: () => void;
}
export default function Header({ page, userName, role, sidebarOpen, onToggleSidebar }: HeaderProps) {
  const [title, description] = pages[page] || pages.home;
  return <header className="page-header">
    <div className="header-title-group">
      <button type="button" className="sidebar-hamburger icon-button" onClick={onToggleSidebar}
        aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="main-navigation"><Menu size={21} /></button>
      <div><h1 className="page-title" id="page-title" tabIndex={-1}>{title}</h1><p className="page-description">{description}</p></div>
    </div>
    <div className="header-actions">
      <time className="header-date" dateTime={new Date().toLocaleDateString('en-CA')}><CalendarDays size={15} />{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
      <div className="user-profile" aria-label={`Signed in as ${userName}, ${role}`}>
        <span className="user-avatar">{userName.charAt(0).toUpperCase()}</span>
        <div className="user-info-text"><strong>{userName}</strong><span>{role}</span></div>
      </div>
    </div>
  </header>;
}
