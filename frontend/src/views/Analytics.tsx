import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, ShoppingBag, Loader2, ArrowUpRight, Activity } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartItem {
  date: string;
  amount: number;
}

interface ProductShare {
  name: string;
  quantity: number;
}

interface AnalyticsData {
  totalRevenue: number;
  topProduct: string;
  totalSalesCount: number;
  chartData: ChartItem[];
  productShares: ProductShare[];
}

const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({
    totalRevenue: 0,
    topProduct: 'None',
    totalSalesCount: 0,
    chartData: [],
    productShares: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: salesList, error: salesError } = await supabase
        .from('sales')
        .select('total_amount, quantity, sale_date, products(product_name)');

      if (salesError) throw salesError;

      const salesArr = salesList || [];

      // Calculate stats
      const totalRevenue = salesArr.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
      const totalSalesCount = salesArr.reduce((sum, s) => sum + parseInt(s.quantity), 0);

      const productSalesMap: Record<string, number> = {};
      salesArr.forEach((s: any) => {
        const name = s.products?.product_name || 'Deleted Item';
        productSalesMap[name] = (productSalesMap[name] || 0) + parseInt(s.quantity);
      });

      let topProduct = 'None';
      let maxQty = 0;
      Object.entries(productSalesMap).forEach(([name, qty]) => {
        if (qty > maxQty) {
          maxQty = qty;
          topProduct = name;
        }
      });

      // Product distribution for Doughnut Chart
      const productShares: ProductShare[] = Object.entries(productSalesMap).map(([name, quantity]) => ({
        name,
        quantity
      }));

      // Sales over time (Group by Date)
      let maxDate = new Date();
      if (salesArr.length > 0) {
        const sortedSalesByDate = [...salesArr].sort((a, b) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime());
        const latestSaleStr = sortedSalesByDate[sortedSalesByDate.length - 1].sale_date;
        const parts = latestSaleStr.split('-');
        if (parts.length === 3) {
          maxDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
      }

      // Generate 7 days leading up to latest sale date
      const last7Days: string[] = [];
      const salesDateMap: Record<string, number> = {};

      for (let i = 6; i >= 0; i--) {
        const d = new Date(maxDate);
        d.setDate(maxDate.getDate() - i);
        const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        last7Days.push(dateKey);
        salesDateMap[dateKey] = 0;
      }

      // Populate from database
      salesArr.forEach((s) => {
        const parts = s.sale_date.split('-');
        if (parts.length === 3) {
          const saleDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          const dateKey = saleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dateKey in salesDateMap) {
            salesDateMap[dateKey] += parseFloat(s.total_amount);
          }
        }
      });

      const chartData: ChartItem[] = last7Days.map(date => ({
        date,
        amount: salesDateMap[date]
      }));

      setData({
        totalRevenue,
        topProduct,
        totalSalesCount,
        chartData,
        productShares
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to query analytics records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && data.chartData.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  // 1. Line Chart Config (Revenue Trend - Sage Blue Theme)
  const lineConfig = {
    labels: data.chartData.map((item) => item.date),
    datasets: [
      {
        label: 'Revenue (₱)',
        data: data.chartData.map((item) => item.amount),
        borderColor: '#66756B', // Green primary accent
        borderWidth: 3.5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#66756B',
        pointBorderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 8,
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(102, 117, 107, 0.28)');
          gradient.addColorStop(1, 'rgba(102, 117, 107, 0.00)');
          return gradient;
        },
        tension: 0.35,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        titleFont: { family: 'Inter', size: 12, weight: 'bold' as const },
        bodyFont: { family: 'Inter', size: 13 },
        padding: 12,
        cornerRadius: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(102, 117, 107, 0.08)', drawTicks: false },
        ticks: { color: '#6B7280', font: { family: 'Inter', size: 11 }, padding: 10 }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6B7280', font: { family: 'Inter', size: 11 } }
      }
    }
  };

  // 2. Doughnut Chart Config (Product shares - Light Sage Theme harmonious color palette)
  const doughnutColors = ['#66756B', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4'];
  const doughnutConfig = {
    labels: data.productShares.map(p => p.name),
    datasets: [
      {
        data: data.productShares.map(p => p.quantity),
        backgroundColor: doughnutColors,
        borderWidth: 3,
        borderColor: '#ffffff', // clean white borders for light mode
        hoverOffset: 6
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#1F2937', // dark text color for readability in light mode
          font: { family: 'Inter', size: 12, weight: 500 },
          boxWidth: 12,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        padding: 12,
        cornerRadius: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      }
    },
    cutout: '72%'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="ui-alert ui-alert-error">{error}</div>}

      {/* 3 Stats Cards Row */}
      <div className="stats-grid">
        {/* Total Revenue */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Total Revenue
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              ₱{data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#22C55E', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <ArrowUpRight size={12} /> +12.5% <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>vs last month</span>
            </span>
          </div>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(102, 117, 107, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Top Product */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Best Selling Item
            </p>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '200px' }}>
              {data.topProduct}
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Top performer in sales</span>
          </div>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <Award size={22} />
          </div>
        </div>

        {/* Total Products Sold */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Total Products Sold
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              {data.totalSalesCount} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>units</span>
            </h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <Activity size={12} /> Active sales <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>processed</span>
            </span>
          </div>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <ShoppingBag size={22} />
          </div>
        </div>
      </div>

      {/* Modern Dashboard Charts Grid */}
      <div className="content-grid-2" style={{ gap: '1.5rem' }}>
        {/* Left Side: Revenue Trend */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            Revenue Trend (Last 7 Days)
          </h3>
          <div style={{ height: '320px', position: 'relative' }}>
            {data.chartData.length > 0 ? (
              <Line data={lineConfig} options={lineOptions} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No transaction data available.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Product Share Doughnut */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            Sales Breakdown by Product
          </h3>
          <div style={{ height: '320px', position: 'relative' }}>
            {data.productShares.length > 0 ? (
              <Doughnut data={doughnutConfig} options={doughnutOptions} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No share data available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
