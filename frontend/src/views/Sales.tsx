import React, { useState, useEffect } from 'react';
import { Loader2, Coins, Search, ShoppingBag, FileSpreadsheet, ArrowUpRight, Trash2, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { encryptField, decryptField } from '../utils/crypto';
import { downloadExcel, parseDateOnly, type SheetData } from '../utils/excel';

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

interface SalesProps {
  role: string;
}

const Sales: React.FC<SalesProps> = ({ role }) => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<SaleRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Clearing the whole ledger is irreversible, so it is typed-to-confirm
  const [showClearHistory, setShowClearHistory] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      })).sort((a, b) => {
        const aOut = a.available <= 0;
        const bOut = b.available <= 0;
        if (aOut && !bOut) return 1;
        if (!aOut && bOut) return -1;
        return a.product_name.localeCompare(b.product_name);
      }));
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

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;

    setDeleting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('sale_id', saleToDelete.sale_id)
        .select('sale_id');

      if (deleteError) throw deleteError;
      if (!deletedRows?.length) throw new Error('This sale could not be deleted. Administrator access is required.');

      setSales(currentSales => currentSales.filter(sale => sale.sale_id !== saleToDelete.sale_id));
      setSaleToDelete(null);
      showSuccess('Sale deleted successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete sale.');
    } finally {
      setDeleting(false);
    }
  };

  // DELETE ALL SALES HISTORY — wipes the ledger, Admin only.
  // Stock is deliberately left untouched: this purges records, it does not
  // reverse the transactions (same behaviour as deleting a single sale).
  const handleClearHistory = async () => {
    if (role !== 'Admin') {
      setError('Only Admins can delete the sales history.');
      return;
    }

    setClearing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('sales')
        .delete()
        .gt('sale_id', 0)
        .select('sale_id');

      if (deleteError) throw deleteError;
      if (!deletedRows?.length) throw new Error('No records were deleted. Administrator access is required.');

      setSales([]);
      setShowClearHistory(false);
      setClearConfirmText('');
      showSuccess(`Deleted all ${deletedRows.length} sales record${deletedRows.length === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete sales history.');
    } finally {
      setClearing(false);
    }
  };

  const closeClearHistory = () => {
    setShowClearHistory(false);
    setClearConfirmText('');
  };

  // The exported report always covers every transaction on record, never just
  // the rows matching the current search, so the file is a complete ledger.
  const handleExportExcel = async () => {
    setExporting(true);
    setError(null);

    try {
      const rows: SheetData = [
        [
          { value: 'Sale ID', fontWeight: 'bold' },
          { value: 'Date', fontWeight: 'bold' },
          { value: 'Customer', fontWeight: 'bold' },
          { value: 'Product', fontWeight: 'bold' },
          { value: 'Quantity', fontWeight: 'bold' },
          { value: 'Total Amount', fontWeight: 'bold' }
        ],
        ...sales.map(s => [
          { value: s.sale_id, type: Number },
          { value: parseDateOnly(s.sale_date), type: Date, format: 'yyyy-mm-dd' },
          { value: s.customer_name, type: String },
          { value: `${s.product_name} (${s.unit})`, type: String },
          { value: s.quantity, type: Number },
          { value: s.total_amount, type: Number, format: '#,##0.00' }
        ]),
        [
          null,
          null,
          null,
          { value: 'TOTAL', fontWeight: 'bold' },
          { value: totalSalesQuantity, type: Number, fontWeight: 'bold' },
          { value: totalSalesRevenue, type: Number, format: '#,##0.00', fontWeight: 'bold' }
        ]
      ];

      await downloadExcel(
        `sales_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        [{ width: 10 }, { width: 14 }, { width: 22 }, { width: 30 }, { width: 11 }, { width: 16 }],
        rows
      );
      showSuccess(`Exported all ${sales.length} transaction${sales.length === 1 ? '' : 's'} to Excel.`);
    } catch (err: any) {
      setError(err.message || 'Failed to export the Excel file.');
    } finally {
      setExporting(false);
    }
  };

  // Filter sales
  const filteredSales = sales.filter(s => 
    s.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Whole-ledger totals — shown on the stat card and written to the Excel export
  const totalSalesRevenue = sales.reduce((acc, curr) => acc + curr.total_amount, 0);
  const totalSalesQuantity = sales.reduce((acc, s) => acc + s.quantity, 0);

  // Totals for the rows currently on screen, which the table footer reports
  const filteredTotalQuantity = filteredSales.reduce((acc, s) => acc + s.quantity, 0);
  const filteredTotalAmount = filteredSales.reduce((acc, s) => acc + s.total_amount, 0);

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
              type="text" className="form-input" placeholder="Name"
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

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportExcel}
            disabled={sales.length === 0 || exporting}
            style={{ gap: '0.4rem', height: '38px', borderRadius: '16px' }}
            title="Export all transactions to Excel, sized to fit and with totals"
          >
            {exporting ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />} Export Excel
          </button>

          {role === 'Admin' && (
            <button
              className="btn btn-sm danger-outline-button"
              onClick={() => setShowClearHistory(true)}
              disabled={sales.length === 0 || clearing}
              style={{ gap: '0.4rem', height: '38px', borderRadius: '16px', padding: '0 0.9rem' }}
              title={sales.length === 0 ? 'No sales history to delete' : 'Delete all sales history'}
            >
              <Trash2 size={14} /> Delete All History
            </button>
          )}
        </div>
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
                  <th style={{ textAlign: 'center' }}>Total Paid</th>
                  {role === 'Admin' && <th style={{ textAlign: 'center' }}>Actions</th>}
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
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                      ₱{sale.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    {role === 'Admin' && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm delete-action-button"
                          onClick={() => setSaleToDelete(sale)}
                          disabled={deleting}
                          style={{ padding: '0.45rem' }}
                          title="Delete Sale"
                          aria-label={`Delete sale for ${sale.customer_name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                    TOTAL{searchQuery ? ' (filtered)' : ''}
                  </td>
                  <td style={{ fontWeight: 700 }}>{filteredTotalQuantity}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                    ₱{filteredTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {role === 'Admin' && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No transaction logs match your criteria.</p>
          </div>
        )}
      </div>

      {showClearHistory && (
        <div className="modal-overlay">
          <div className="modal-content delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="clear-history-title">
            <div className="modal-header">
              <h3 id="clear-history-title" className="delete-confirm-title">
                <AlertTriangle size={18} /> Delete All Sales History
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeClearHistory}
                disabled={clearing}
                aria-label="Close delete history confirmation"
              >
                <X size={20} />
              </button>
            </div>
            <p className="delete-confirm-message">
              This permanently deletes <strong>all {sales.length} sales record{sales.length === 1 ? '' : 's'}</strong>, worth{' '}
              <strong>₱{totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> in
              logged revenue. Product stock levels are not restored. This cannot be undone.
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="clear-history-confirm">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="clear-history-confirm"
                type="text"
                className="form-input"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                disabled={clearing}
              />
            </div>
            <div className="delete-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={closeClearHistory} disabled={clearing}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleClearHistory}
                disabled={clearing || clearConfirmText !== 'DELETE'}
              >
                {clearing ? <Loader2 className="animate-spin" size={16} /> : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {saleToDelete && (
        <div className="modal-overlay">
          <div className="modal-content delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-sale-title">
            <div className="modal-header">
              <h3 id="delete-sale-title" className="delete-confirm-title">
                <AlertTriangle size={18} /> Delete Sale
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSaleToDelete(null)}
                disabled={deleting}
                aria-label="Close delete confirmation"
              >
                <X size={20} />
              </button>
            </div>
            <p className="delete-confirm-message">
              Permanently delete the sale of <strong>{saleToDelete.quantity} {saleToDelete.unit} of {saleToDelete.product_name}</strong> to <strong>{saleToDelete.customer_name}</strong>? This cannot be undone.
            </p>
            <div className="delete-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSaleToDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDeleteSale} disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
