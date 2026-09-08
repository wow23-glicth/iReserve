import { useState, useEffect } from 'react';
import { Package, Coins, CalendarDays, Users, AlertTriangle, ArrowUpRight, ArrowRight, RefreshCw, CircleCheck, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import StatCard from '../components/StatCard';
import RevenueChart from '../components/RevenueChart';
import { revenueWeek, type RevenueRecord } from '../utils/analytics';
import { formatPeso } from '../utils/sales';
import { availableStock, stockQuantity, stockNeedsReview } from '../utils/stock';
interface Product { product_id: number; product_name: string; stock: number; reserved_stock: number; }
interface Sale extends RevenueRecord { sale_id: number; transaction_id: string | null; }
export default function DashboardHome({ userName, role, onNavigate }: { userName: string; role: string; onNavigate: (page: string) => void }) {
  const [data, setData] = useState<{ products: Product[]; sales: Sale[]; reservations: number; customers: number }>({ products: [], sales: [], reservations: 0, customers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const [products, sales, reservations, customers] = await Promise.all([
        supabase.from('products').select('product_id, product_name, stock, reserved_stock'),
        supabase.from('sales').select('sale_id, transaction_id, total_amount, quantity, sale_date'),
        supabase.from('reservations').select('reservation_id', { count: 'exact', head: true }),
        supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
      ]);
      for (const result of [products, sales, reservations, customers]) if (result.error) throw result.error;
      setData({ products: products.data || [], sales: sales.data || [], reservations: reservations.count || 0, customers: customers.count || 0 });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load the dashboard. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    fetchData();
    const channel = supabase.channel('dashboard-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchData).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  const lowStock = data.products.filter(p => availableStock(p.stock, p.reserved_stock) <= 5).sort((a, b) => availableStock(a.stock, a.reserved_stock) - availableStock(b.stock, b.reserved_stock));
  const points = revenueWeek(data.sales);
  const weekRevenue = points.reduce((sum, p) => sum + p.amount, 0);
  const transactions = new Set(data.sales.map(s => s.transaction_id || `legacy-${s.sale_id}`)).size;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const canManageStock = ['Admin', 'Manager'].includes(role);
  return <div className="view-stack dashboard-view">
    {error && <div role="alert" className="ui-alert ui-alert-error"><span>{error}</span><button className="btn btn-secondary btn-sm" onClick={fetchData}><RefreshCw size={14} /> Retry</button></div>}
    <section className="dashboard-welcome">
      <div><h2>{greeting}, {userName.split(' ')[0]}.</h2><p>A little clarity for a productive day.</p></div>
      <div className="brand-banner"><div><strong>Build better.<br />Grow together.</strong><span>with PJP Hardware</span></div><img src="/hardware-workspace.png" alt="" /></div>
    </section>
    <div className="stats-grid">
      <StatCard label="Total products" value={error ? '—' : data.products.length} detail="Products in your inventory" icon={<Package size={21} />} loading={loading} />
      <StatCard label="Sales made" value={error ? '—' : transactions} detail="Completed transactions" icon={<Coins size={21} />} loading={loading} />
      <StatCard label="Reservations" value={error ? '—' : data.reservations} detail="All customer requests" icon={<CalendarDays size={21} />} loading={loading} />
      <StatCard label="Customers" value={error ? '—' : data.customers} detail="Customers on record" icon={<Users size={21} />} loading={loading} />
    </div>
    <div className="dashboard-grid">
      <section className="glass-panel chart-panel">
        <div className="panel-heading"><div><h3>Sales overview</h3><p>Revenue over the last 7 days</p></div><span className="period-label">Last 7 days</span></div>
        <div className="chart-total">{error ? '—' : formatPeso(weekRevenue)}<span>Total revenue this week</span></div>
        <div className="chart-frame">{loading ? <div className="loading-state"><Loader2 className="animate-spin" size={25} /></div> : error ? <div className="empty-state"><p>Revenue is unavailable. Retry to load your records.</p></div> : <RevenueChart points={points} />}</div>
        <button className="text-button chart-link" onClick={() => onNavigate('analytics')}>Explore analytics <ArrowUpRight size={15} /></button>
      </section>
      <section className="glass-panel stock-panel">
        <div className="panel-heading"><div className="heading-with-icon"><AlertTriangle size={18} /><h3>Low stock alerts</h3></div>{!error && <span className="count-badge">{lowStock.length}</span>}</div>
        <p className="panel-description">Products with 5 or fewer available units.</p>
        {loading ? <div className="loading-state"><Loader2 className="animate-spin" size={24} /></div> : error ? <div className="empty-state"><p>Stock information is unavailable.</p></div> : data.products.length === 0 ? <div className="empty-state"><Package size={34} /><h4>No products yet</h4><p>{canManageStock ? "Add your first product in Inventory to start tracking stock." : "Stock levels will appear when your team adds products."}</p></div> : lowStock.length ? <div className="stock-list">{lowStock.slice(0, 5).map(item => <div className="low-stock-item" key={item.product_id}>
          <span className="product-icon"><Package size={19} /></span><div className="stock-product"><strong>{item.product_name}</strong><span>Product #{item.product_id} · {stockQuantity(item.reserved_stock)} reserved</span>{stockNeedsReview(item.stock, item.reserved_stock) && <span className="stock-review">Stock needs review</span>}</div><span className="badge badge-danger">{availableStock(item.stock, item.reserved_stock)} left</span>
        </div>)}</div> : <div className="empty-state healthy-state"><CircleCheck size={34} /><h4>Stock is looking good</h4><p>All products have more than 5 available units.</p></div>}
        {canManageStock && <button className="text-button stock-link" onClick={() => onNavigate('products')}>View inventory <ArrowRight size={15} /></button>}
      </section>
    </div>
    <section className="quick-actions" aria-label="Quick actions"><div><h3>Keep business moving</h3><p>Your everyday tasks, a click away.</p></div><div><button className="btn btn-primary" onClick={() => onNavigate('sales')}><Coins size={17} /> Go to sales <ArrowUpRight size={16} /></button><button className="btn btn-secondary" onClick={() => onNavigate('reservations')}><CalendarDays size={17} /> Manage reservations</button></div></section>
  </div>;
}
