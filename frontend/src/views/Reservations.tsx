import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Trash2, FileText, Search, Filter, Download, ArrowUpRight, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { encryptField, decryptField } from '../utils/crypto';

interface Product {
  product_id: number;
  product_name: string;
  unit: string;
  available: number;
}

interface ReservationRecord {
  reservation_id: number;
  customer_name: string;
  product_name: string;
  unit: string;
  quantity: number;
  reservation_date: string;
  status: string;
  product_id: number;
}

const Reservations: React.FC = () => {
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Loading states for individual row actions
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRes, prodRes] = await Promise.all([
        supabase.from('reservations').select('*, products(product_name, unit), customers(name)').order('reservation_id', { ascending: false }),
        supabase.from('products').select('*').order('product_name', { ascending: true })
      ]);
      if (resRes.error) throw resRes.error;
      if (prodRes.error) throw prodRes.error;

      const rawReservations = resRes.data || [];
      const decryptedReservations = await Promise.all(
        rawReservations.map(async (row: any) => ({
          reservation_id: row.reservation_id,
          customer_name: await decryptField(row.customers?.name || 'Unknown'),
          product_name: row.products?.product_name || 'Deleted Item',
          unit: row.products?.unit || '',
          quantity: parseInt(row.quantity),
          reservation_date: row.reservation_date,
          status: row.status,
          product_id: row.product_id
        }))
      );
      setReservations(decryptedReservations);

      setProducts((prodRes.data || []).map((p: any) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        unit: p.unit,
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
    const channel = supabase.channel('reservations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // CSV Export Functionality
  const handleExportCSV = () => {
    const headers = ['Reservation ID', 'Customer', 'Product', 'Quantity', 'Status', 'Date'];
    const rows = filteredReservations.map(r => [
      r.reservation_id,
      `"${r.customer_name}"`,
      `"${r.product_name} (${r.unit})"`,
      r.quantity,
      r.status,
      new Date(r.reservation_date).toLocaleDateString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reservations_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Exported CSV successfully!');
  };

  // CREATE RESERVATION
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    const targetProductId = parseInt(productId);
    const qtyVal = parseInt(quantity);
    const trimmedCustomer = customerName.trim();

    try {
      if (!trimmedCustomer || !targetProductId || qtyVal <= 0) throw new Error('All fields are required.');

      // Encrypt PII before storing
      const encryptedName = await encryptField(trimmedCustomer);
      let customerId: number;
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

      if (existingCustomer) {
        customerId = existingCustomer.customer_id;
      } else {
        const { data: newCust, error: custInsertErr } = await supabase.from('customers')
          .insert({ name: encryptedName }).select('customer_id').single();
        if (custInsertErr) throw custInsertErr;
        customerId = newCust.customer_id;
      }

      // Check available stock
      const { data: prodData, error: prodErr } = await supabase.from('products')
        .select('stock, reserved_stock').eq('product_id', targetProductId).single();
      if (prodErr) throw prodErr;

      const avail = prodData.stock - prodData.reserved_stock;
      if (qtyVal > avail) {
        throw new Error(`Insufficient stock. Only ${avail} units available.`);
      }

      // Insert reservation (defaults to Pending)
      const { error: resErr } = await supabase.from('reservations').insert({
        customer_id: customerId,
        product_id: targetProductId,
        quantity: qtyVal,
        status: 'Pending'
      });

      if (resErr) throw resErr;

      showSuccess('Reservation request submitted successfully.');
      setCustomerName('');
      setProductId('');
      setQuantity('1');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  // APPROVE RESERVATION (deducts stock and transitions to Approved)
  const handleApprove = async (resId: number, prodId: number, qty: number) => {
    setActionId(resId); setError(null);
    try {
      // 1. Double check stock availability
      const { data: prodData, error: prodErr } = await supabase.from('products')
        .select('stock, reserved_stock').eq('product_id', prodId).single();
      if (prodErr) throw prodErr;

      const avail = prodData.stock - prodData.reserved_stock;
      if (qty > avail) throw new Error('Cannot approve. Insufficient available stock.');

      // 2. Update reservation status
      const { error: updateResErr } = await supabase.from('reservations')
        .update({ status: 'Approved' }).eq('reservation_id', resId);
      if (updateResErr) throw updateResErr;

      // 3. Update products reserved stock
      const { error: updateProdErr } = await supabase.from('products')
        .update({ reserved_stock: prodData.reserved_stock + qty }).eq('product_id', prodId);
      if (updateProdErr) throw updateProdErr;

      showSuccess('Reservation approved and stock reserved.');
    } catch (err: any) {
      setError(err.message || 'Failed to approve reservation.');
    } finally {
      setActionId(null);
    }
  };

  // CLAIM RESERVATION (converts approved reservation to a Sale record)
  const handleClaim = async (resId: number, prodId: number, qty: number, customerName: string) => {
    setActionId(resId); setError(null);
    try {
      // 1. Get customer ID
      const { data: custData, error: custErr } = await supabase.from('customers').select('customer_id').eq('name', customerName).single();
      if (custErr) throw custErr;

      // 2. Get product price
      const { data: prodData, error: prodErr } = await supabase.from('products').select('price, stock, reserved_stock').eq('product_id', prodId).single();
      if (prodErr) throw prodErr;

      const totalPrice = prodData.price * qty;

      // 3. Insert sale
      const { error: saleErr } = await supabase.from('sales').insert({
        customer_id: custData.customer_id,
        product_id: prodId,
        quantity: qty,
        total_amount: totalPrice
      });
      if (saleErr) throw saleErr;

      // 4. Update product stock (deduct actual stock and release reserved stock)
      const { error: updateProdErr } = await supabase.from('products')
        .update({
          stock: prodData.stock - qty,
          reserved_stock: Math.max(0, prodData.reserved_stock - qty)
        }).eq('product_id', prodId);
      if (updateProdErr) throw updateProdErr;

      // 5. Update reservation status to Claimed
      const { error: updateResErr } = await supabase.from('reservations')
        .update({ status: 'Claimed' }).eq('reservation_id', resId);
      if (updateResErr) throw updateResErr;

      showSuccess('Reservation claimed and converted to a Sale.');
    } catch (err: any) {
      setError(err.message || 'Failed to claim reservation.');
    } finally {
      setActionId(null);
    }
  };

  // CANCEL RESERVATION
  const handleCancel = async (resId: number, prodId: number, qty: number, currentStatus: string) => {
    setActionId(resId); setError(null);
    try {
      // 1. Update reservation status to Cancelled
      const { error: updateResErr } = await supabase.from('reservations')
        .update({ status: 'Cancelled' }).eq('reservation_id', resId);
      if (updateResErr) throw updateResErr;

      // 2. Release reserved stock if it was Approved
      if (currentStatus === 'Approved') {
        const { data: prodData } = await supabase.from('products').select('reserved_stock').eq('product_id', prodId).single();
        if (prodData) {
          const newReserved = Math.max(0, prodData.reserved_stock - qty);
          await supabase.from('products').update({ reserved_stock: newReserved }).eq('product_id', prodId);
        }
      }

      showSuccess('Reservation cancelled.');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel reservation.');
    } finally {
      setActionId(null);
    }
  };

  // DELETE RESERVATION RECORD
  const handleDelete = async (resId: number, prodId: number, qty: number, currentStatus: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this reservation record?')) return;
    setActionId(resId); setError(null);
    try {
      const { error: deleteErr } = await supabase.from('reservations').delete().eq('reservation_id', resId);
      if (deleteErr) throw deleteErr;

      // If deleted while approved, release the reserved stock
      if (currentStatus === 'Approved') {
        const { data: prodData } = await supabase.from('products').select('reserved_stock').eq('product_id', prodId).single();
        if (prodData) {
          const newReserved = Math.max(0, prodData.reserved_stock - qty);
          await supabase.from('products').update({ reserved_stock: newReserved }).eq('product_id', prodId);
        }
      }

      showSuccess('Reservation deleted.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete reservation.');
    } finally {
      setActionId(null);
    }
  };

  // Compute Reservation stats dynamically
  const statsTotal = reservations.length;
  const statsApproved = reservations.filter(r => r.status === 'Approved').length;
  const statsPending = reservations.filter(r => r.status === 'Pending').length;
  const statsCancelled = reservations.filter(r => r.status === 'Cancelled').length;

  // Filter & Search Logic
  const filteredReservations = reservations.filter(r => {
    const matchesSearch = r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div className="ui-alert ui-alert-success">{successMsg}</div>}

      {/* ── Dynamic Statistics Cards ── */}
      <div className="stats-grid">
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Total Reservations
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{statsTotal}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All time requests</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', color: 'var(--primary)', justifyContent: 'center' }}>
            <FileText size={20} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Approved
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#22C55E' }}>{statsApproved}</h2>
            <span style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
              <ArrowUpRight size={10} /> Active reserves
            </span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', color: '#22C55E', justifyContent: 'center' }}>
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Pending Review
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#F59E0B' }}>{statsPending}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Awaiting action</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', color: '#F59E0B', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Cancelled
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#EF4444' }}>{statsCancelled}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Declined or cancelled</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', color: '#EF4444', justifyContent: 'center' }}>
            <XCircle size={20} />
          </div>
        </div>
      </div>

      {/* ── Create Reservation — Premium layout ── */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Create New Reservation</h3>
        <form onSubmit={handleCreateReservation} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer Name</label>
            <input
              type="text" className="form-input" placeholder="e.g. porman dice"
              value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Product</label>
            <select
              className="form-select" value={productId} onChange={(e) => setProductId(e.target.value)}
              required
            >
              <option value="">Choose item...</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id} disabled={p.available <= 0}>
                  {p.product_name} – {p.available > 0 ? `${p.available} ${p.unit} avail.` : 'No Stock'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Quantity</label>
            <input
              type="number" className="form-input" min="1" value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ height: '46px' }}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Reserve Item'}
          </button>
        </form>
      </div>

      {/* ── Table Toolbar Controls: Search, Filter, Export ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '380px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by customer or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        {/* Filter & Export */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.45)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '0.2rem 0.75rem' }}>
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                padding: '0.4rem 0.5rem',
                cursor: 'pointer'
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Claimed">Claimed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} style={{ gap: '0.4rem', height: '38px', borderRadius: '16px' }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Reservations Table ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {loading && reservations.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : filteredReservations.length > 0 ? (
          <div className="table-container">
            <table className="custom-table reservations-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Date Requested</th>
                  <th>Status</th>
                  <th style={{ width: '250px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((res) => (
                  <tr key={res.reservation_id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{res.customer_name}</strong></td>
                    <td>{res.product_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({res.unit})</span></td>
                    <td style={{ fontWeight: 600 }}>{res.quantity}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(res.reservation_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge ${
                        res.status === 'Approved' 
                          ? 'badge-success' 
                          : res.status === 'Pending' 
                          ? 'badge-warning' 
                          : res.status === 'Claimed' 
                          ? 'badge-info' 
                          : 'badge-danger'
                      }`}>
                        {res.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {/* Pending Actions */}
                        {res.status === 'Pending' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(res.reservation_id, res.product_id, res.quantity)}
                              disabled={actionId !== null}
                              style={{ gap: '0.2rem', padding: '0.35rem 0.75rem' }}
                              title="Approve Reservation"
                            >
                              {actionId === res.reservation_id ? <Loader2 className="animate-spin" size={12} /> : 'Approve'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleCancel(res.reservation_id, res.product_id, res.quantity, res.status)}
                              disabled={actionId !== null}
                              style={{ gap: '0.2rem', padding: '0.35rem 0.75rem' }}
                              title="Cancel Reservation"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {/* Approved Actions */}
                        {res.status === 'Approved' && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleClaim(res.reservation_id, res.product_id, res.quantity, res.customer_name)}
                              disabled={actionId !== null}
                              style={{ padding: '0.35rem 0.75rem' }}
                              title="Claim Order & Convert to Sale"
                            >
                              {actionId === res.reservation_id ? <Loader2 className="animate-spin" size={12} /> : 'Claim'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleCancel(res.reservation_id, res.product_id, res.quantity, res.status)}
                              disabled={actionId !== null}
                              style={{ padding: '0.35rem 0.75rem' }}
                              title="Cancel Reservation"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {/* Delete Action */}
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDelete(res.reservation_id, res.product_id, res.quantity, res.status)}
                          disabled={actionId !== null}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: 'var(--danger)',
                            border: '1px solid rgba(239, 68, 68, 0.22)',
                            padding: '0.45rem'
                          }}
                          title="Delete Reservation Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No reservations found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reservations;
