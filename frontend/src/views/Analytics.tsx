import { useEffect, useState } from 'react';
import { Award, Package, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { supabase } from '../supabaseClient';
import StatCard from '../components/StatCard';
import RevenueChart from '../components/RevenueChart';
import { revenueWeek, type RevenueRecord } from '../utils/analytics';
import { formatPeso } from '../utils/sales';
interface Sale extends RevenueRecord { products: { product_name: string } | null; }
const colors = ['#22694e', '#4fa990', '#d7ae45', '#7194c6', '#9682b1', '#be785b', '#7a866b'];
export default function Analytics() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: queryError } = await supabase.from('sales').select('total_amount, quantity, sale_date, products(product_name)');
      if (queryError) throw queryError;
      setSales((data || []).map(row => ({ ...row, products: Array.isArray(row.products) ? row.products[0] || null : row.products })));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load analytics. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    fetchData();
    const channel = supabase.channel('analytics-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchData).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  const totalRevenue = sales.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const totalUnits = sales.reduce((sum, row) => sum + Number(row.quantity), 0);
  const products = new Map<string, number>();
  sales.forEach(row => { const name = row.products?.product_name || 'Deleted item'; products.set(name, (products.get(name) || 0) + Number(row.quantity)); });
  const ranked = Array.from(products, ([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity);
  const shares = ranked.length > 6 ? [...ranked.slice(0, 6), { name: 'Other products', quantity: ranked.slice(6).reduce((sum, item) => sum + item.quantity, 0) }] : ranked;
  const points = revenueWeek(sales);
  return <div className="view-stack">
    {error && <div role="alert" className="ui-alert ui-alert-error"><span>{error}</span><button className="btn btn-secondary btn-sm" onClick={fetchData}><RefreshCw size={14} /> Retry</button></div>}
    <div className="stats-grid">
      <StatCard label="Total revenue" value={error ? '—' : formatPeso(totalRevenue)} detail="Across all recorded sales" icon={<TrendingUp size={21} />} loading={loading} />
      <StatCard label="Best selling item" value={error ? '—' : ranked[0]?.name || 'No sales yet'} detail="Highest quantity sold · all time" icon={<Award size={21} />} tone="amber" loading={loading} />
      <StatCard label="Total products sold" value={error ? '—' : totalUnits.toLocaleString()} detail="Units sold across all transactions" icon={<Package size={21} />} loading={loading} />
    </div>
    <div className="content-grid-2">
      <section className="glass-panel chart-panel"><div className="panel-heading"><div><h3>Revenue trend</h3><p>Daily sales over the last 7 days</p></div><span className="period-label">Last 7 days</span></div><div className="chart-total">{error ? '—' : formatPeso(points.reduce((sum, p) => sum + p.amount, 0))}<span>This week</span></div><div className="chart-frame">{loading ? <div className="loading-state"><Loader2 className="animate-spin" size={25} /></div> : error ? <div className="empty-state"><p>Revenue data is unavailable.</p></div> : <RevenueChart points={points} />}</div></section>
      <section className="glass-panel chart-panel"><div className="panel-heading"><div><h3>Sales by product</h3><p>Share of units sold · all time</p></div></div>
        {loading ? <div className="loading-state"><Loader2 className="animate-spin" size={25} /></div> : error ? <div className="empty-state"><p>Product data is unavailable.</p></div> : shares.length ? <div className="distribution-layout">
          <div className="donut-frame"><Doughnut role="img" aria-label={'Units sold: ' + shares.map(item => `${item.name}: ${item.quantity}`).join(', ')} data={{ labels: shares.map(item => item.name), datasets: [{ data: shares.map(item => item.quantity), backgroundColor: colors, borderColor: '#fcfdf8', borderWidth: 4, hoverOffset: 4 }] }} options={{ responsive: true, maintainAspectRatio: false, animation: false, cutout: '74%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#153d2d', padding: 12 } } }} /><div className="donut-center"><span>Units sold</span><strong>{totalUnits.toLocaleString()}</strong></div></div>
          <ul className="chart-legend">{shares.map((item, index) => <li key={item.name}><i style={{ background: colors[index] }} /><span>{item.name}</span><strong>{totalUnits ? Math.round(item.quantity / totalUnits * 100) : 0}%</strong></li>)}</ul>
        </div> : <div className="empty-state"><Package size={32} /><h4>Your sales story starts here</h4><p>Record a sale to see your product breakdown.</p></div>}
      </section>
    </div>
    <div className="analytics-note"><TrendingUp size={17} /><p>Revenue includes recorded sales. Reservations contribute only after they become a sale.</p></div>
  </div>;
}
