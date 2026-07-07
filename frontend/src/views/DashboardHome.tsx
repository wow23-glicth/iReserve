import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Coins, Calendar, Users, AlertTriangle, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';

interface DashboardStats {
  products: number;
  sales: number;
  reservations: number;
  customers: number;
}

interface LowStockItem {
  product_id: number;
  product_name: string;
  unit: string;
  stock: number;
  reserved_stock: number;
  available: number;
}

const DashboardHome: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({ products: 0, sales: 0, reservations: 0, customers: 0 });
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, salesCountRes, resCountRes, custCountRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('sales').select('sale_id', { count: 'exact', head: true }),
        supabase.from('reservations').select('reservation_id', { count: 'exact', head: true }),
        supabase.from('customers').select('customer_id', { count: 'exact', head: true })
      ]);

      if (prodRes.error) throw prodRes.error;

      const productsList = prodRes.data || [];
      const lowStockItems: LowStockItem[] = productsList
        .map((p: any) => ({
          product_id: p.product_id,
          product_name: p.product_name,
          unit: p.unit,
          stock: p.stock,
          reserved_stock: p.reserved_stock,
          available: p.stock - p.reserved_stock
        }))
        .filter((p) => p.available <= 5);

      setStats({
        products: productsList.length,
        sales: salesCountRes.count || 0,
        reservations: resCountRes.count || 0,
        customers: custCountRes.count || 0
      });
      setLowStock(lowStockItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const statItems = [
    { 
      label: 'Total Products', 
      val: stats.products, 
      color: 'var(--primary)', 
      bgColor: 'rgba(102, 117, 107, 0.1)', 
      icon: <Package size={22} style={{ color: 'var(--primary)' }} />,
      growth: '+12%'
    },
    { 
      label: 'Sales Made', 
      val: stats.sales, 
      color: '#22C55E', 
      bgColor: 'rgba(34, 197, 94, 0.1)', 
      icon: <Coins size={22} style={{ color: '#22C55E' }} />,
      growth: '+8%'
    },
    { 
      label: 'Reservations', 
      val: stats.reservations, 
      color: '#F59E0B', 
      bgColor: 'rgba(245, 158, 11, 0.1)', 
      icon: <Calendar size={22} style={{ color: '#F59E0B' }} />,
      growth: '+5%'
    },
    { 
      label: 'Customers', 
      val: stats.customers, 
      color: '#10B981', 
      bgColor: 'rgba(16, 185, 129, 0.1)', 
      icon: <Users size={22} style={{ color: '#10B981' }} />,
      growth: '+10%'
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && (
        <div className="ui-alert ui-alert-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
          <span>{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchDashboardData} style={{ gap: '0.4rem', marginLeft: 'auto' }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="stats-grid">
        {statItems.map((item, idx) => (
          <div 
            key={idx} 
            className="glass-panel glass-panel-hover" 
            style={{ 
              padding: '1.5rem', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Soft background glow */}
            <div style={{
              position: 'absolute',
              top: '-15%',
              right: '-10%',
              width: '80px',
              height: '80px',
              background: item.bgColor,
              filter: 'blur(20px)',
              borderRadius: '50%'
            }} />

            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {item.label}
              </p>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                {loading ? <Loader2 className="animate-spin" size={24} style={{ color: 'var(--text-muted)' }} /> : item.val}
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#22C55E', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <TrendingUp size={12} /> {item.growth} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>from last week</span>
              </span>
            </div>

            <div 
              style={{ 
                width: '54px', 
                height: '54px', 
                borderRadius: '16px', 
                background: item.bgColor, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.02)'
              }}
            >
              {item.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alerts */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Low Stock Alerts
          </h3>
        </div>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : lowStock.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {lowStock.map((item) => (
              <div 
                key={item.product_id} 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  background: 'rgba(239, 68, 68, 0.03)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                  borderRadius: '16px',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(5px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Product ID: #{item.product_id}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Total: <strong style={{ color: 'var(--text-primary)' }}>{item.stock}</strong> | Reserved: <strong style={{ color: 'var(--text-primary)' }}>{item.reserved_stock}</strong>
                  </span>
                  <span className="badge badge-danger" style={{ padding: '0.4rem 1rem' }}>
                    {item.available} units left
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>All stock levels are healthy.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
