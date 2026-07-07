import React, { useState, useEffect } from 'react';
import { Loader2, Coins, Search, ShoppingBag, Download, ArrowUpRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { encryptField, decryptField } from '../utils/crypto';

interface Product {
  product_id: number;
  product_name: string;
  unit: string;
  price: number;
  available: number;
}

interface SaleRecord {
  sale_id: number;
  customer_name: string;
  product_name: string;
  unit: string;
  quantity: number;
  sale_date: string;
  total_amount: number;
}

const Sales: React.FC = () => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, prodRes] = await Promise.all([
        supabase.from('sales').select('*, products(product_name, unit), customers(name)').order('sale_id', { ascending: false }),
        supabase.from('products').select('*').order('product_name', { ascending: true })
      ]);
      if (salesRes.error) throw salesRes.error;
      if (prodRes.error) throw prodRes.error;

      const rawSales = salesRes.data || [];
      const decryptedSales = await Promise.all(
        rawSales.map(async (row: any) => ({
          sale_id: row.sale_id,
          customer_name: await decryptField(row.customers?.name || 'Unknown'),
          product_name: row.products?.product_name || 'Deleted Item',
          unit: row.products?.unit || '',
          quantity: parseInt(row.quantity),
          sale_date: row.sale_date,
          total_amount: parseFloat(row.total_amount)
        }))
      );
      setSales(decryptedSales);

      setProducts((prodRes.data || []).map((p: any) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        unit: p.unit,
        price: parseFloat(p.price),
        available: p.stock - p.reserved_stock
      })));
    } catch (err: any) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(null); setSuccessMsg(null);
    const targetProductId = parseInt(productId);
    const qtyVal = parseInt(quantity);
    const trimmedCustomer = customerName.trim();

    try {
      if (!trimmedCustomer || !targetProductId || qtyVal <= 0) throw new Error('All fields are required.');

      // Encrypt PII before storing — lookup uses encrypted value
      const encryptedName = await encryptField(trimmedCustomer);
      let customerId: number;
      // Fetch all customers and decrypt to find a match (deterministic lookup)
      const { data: allCustomers, error: custFindErr } = await supabase
        .from('customers').select('customer_id, name');
      if (custFindErr) throw custFindErr;

      let existingCustomer: any = null;
      for (const c of (allCustomers || [])) {
        const decrypted = await decryptField(c.name);
        if (decrypted.toLowerCase() === trimmedCustomer.toLowerCase()) {
          existingCustomer = c;
          break;
        }
      }

      if (!existingCustomer) {
        const { data: newCust, error: custInsErr } = await supabase.from('customers')
          .insert({ name: encryptedName }).select('customer_id').single();
        if (custInsErr) throw custInsErr;
        customerId = newCust.customer_id;
      } else {
        customerId = existingCustomer.customer_id;
      }

      // Check stock
      const { data: product, error: prodErr } = await supabase.from('products')
        .select('stock, reserved_stock, price').eq('product_id', targetProductId).single();
      if (prodErr || !product) throw new Error('Product not found.');
      const available = product.stock - product.reserved_stock;
      if (available < qtyVal) throw new Error(`Only ${available} units available.`);

      const totalAmount = parseFloat(product.price) * qtyVal;
      const saleDate = new Date().toISOString().split('T')[0];

      const { error: saleErr } = await supabase.from('sales').insert({
        product_id: targetProductId, customer_id: customerId,
        quantity: qtyVal, sale_date: saleDate, total_amount: totalAmount
      });
      if (saleErr) throw saleErr;

      const { error: stockErr } = await supabase.from('products')
        .update({ stock: product.stock - qtyVal }).eq('product_id', targetProductId);
      if (stockErr) throw stockErr;

      showSuccess('Sale recorded successfully.');
      setCustomerName(''); setProductId(''); setQuantity('1');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to record sale.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Sale ID', 'Date', 'Customer', 'Product', 'Quantity', 'Total Amount'];
    const rows = filteredSales.map(s => [
      s.sale_id,
      new Date(s.sale_date).toLocaleDateString(),
      `"${s.customer_name}"`,
      `"${s.product_name} (${s.unit})"`,
      s.quantity,
      s.total_amount
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Exported CSV successfully!');
  };

  // Filter sales
  const filteredSales = sales.filter(s => 
    s.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSalesRevenue = sales.reduce((acc, curr) => acc + curr.total_amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div className="ui-alert ui-alert-success">{successMsg}</div>}

      {/* Stats Summary row */}
      <div className="stats-grid">
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Total Revenue
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>₱{totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
              <ArrowUpRight size={10} /> Live sync
            </span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', color: '#22C55E', justifyContent: 'center' }}>
            <Coins size={20} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Transactions Logged
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sales.length}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All time logs</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', color: 'var(--primary)', justifyContent: 'center' }}>
            <ShoppingBag size={20} />
          </div>
        </div>
      </div>

      {/* ── Record New Sale — compact inline form ── */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Record New Sale</h3>
        <form onSubmit={handleRecordSale} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer Name</label>
            <input
              type="text" className="form-input" placeholder="e.g. porman dice"
              value={customerName} onChange={(e) => setCustomerName(e.target.value)} required
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Product</label>
            <select className="form-select" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">Choose item...</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id} disabled={p.available <= 0}>
                  {p.product_name} – {p.available > 0 ? `${p.available} ${p.unit} left` : 'Out of Stock'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Quantity</label>
            <input type="number" className="form-input" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ height: '46px' }}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Process Sale'}
          </button>
        </form>
      </div>

      {/* ── Toolbar: Search & Export ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} style={{ gap: '0.4rem', height: '38px', borderRadius: '16px' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* ── Recent Transactions Table ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Transaction Logs</h3>
        {loading && sales.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : filteredSales.length > 0 ? (
          <div className="table-container">
            <table className="custom-table sales-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product Purchased</th>
                  <th>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Total Paid</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.sale_id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(sale.sale_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{sale.customer_name}</strong></td>
                    <td>{sale.product_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({sale.unit})</span></td>
                    <td style={{ fontWeight: 600 }}>{sale.quantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                      ₱{sale.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No transaction logs match your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sales;
