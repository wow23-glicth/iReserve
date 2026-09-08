import ProductPicker from '../components/ProductPicker';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import StatCard from '../components/StatCard';
import ActionPanel from '../components/ActionPanel';
import { availableStock } from '../utils/stock';
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Trash2, FileText, Search, Filter, FileSpreadsheet, Clock, AlertTriangle, X, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { encryptField, decryptField } from '../utils/crypto';
import { downloadExcel, parseDateOnly, type SheetData } from '../utils/excel';

interface Product {
  product_id: number;
  product_name: string;
  unit: string;
  available: number;
}

interface ReservationRecord {
  reservation_id: number;
  customer_id: number;
  customer_name: string;
  product_name: string;
  unit: string;
  quantity: number;
  reservation_date: string;
  status: string;
  product_id: number;
}

interface CartItem {
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  availableStock: number;
}

interface ReservationsProps {
  role: string;
}

// Approving a reservation commits stock, so it stays with the roles that own
// that decision. Cashiers still handle the counter work (create, claim, cancel).
const APPROVER_ROLES = ['Admin', 'Manager'];

const Reservations: React.FC<ReservationsProps> = ({ role }) => {
  const canApprove = APPROVER_ROLES.includes(role);

  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // Cart & Search combobox states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Loading states for individual row actions
  const [actionId, setActionId] = useState<number | null>(null);
  const [reservationToDelete, setReservationToDelete] = useState<ReservationRecord | null>(null);
  const [exporting, setExporting] = useState(false);

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
          customer_id: row.customer_id,
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
        available: availableStock(p.stock, p.reserved_stock)
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

  // Excel Export — a real workbook, so the columns arrive wide enough to read
  const handleExportExcel = async () => {
    setExporting(true);
    setError(null);

    try {
      const totalQuantity = filteredReservations.reduce((acc, r) => acc + r.quantity, 0);
      const rows: SheetData = [
        [
          { value: 'Reservation ID', fontWeight: 'bold' },
          { value: 'Customer', fontWeight: 'bold' },
          { value: 'Product', fontWeight: 'bold' },
          { value: 'Quantity', fontWeight: 'bold' },
          { value: 'Status', fontWeight: 'bold' },
          { value: 'Date', fontWeight: 'bold' }
        ],
        ...filteredReservations.map(r => [
          { value: r.reservation_id, type: Number },
          { value: r.customer_name, type: String },
          { value: `${r.product_name} (${r.unit})`, type: String },
          { value: r.quantity, type: Number },
          { value: r.status, type: String },
          { value: parseDateOnly(r.reservation_date), type: Date, format: 'yyyy-mm-dd' }
        ]),
        [
          null,
          null,
          { value: 'TOTAL', fontWeight: 'bold' },
          { value: totalQuantity, type: Number, fontWeight: 'bold' },
          null,
          null
        ]
      ];

      await downloadExcel(
        `reservations_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        [{ width: 15 }, { width: 22 }, { width: 30 }, { width: 11 }, { width: 13 }, { width: 14 }],
        rows
      );
      showSuccess(`Exported ${filteredReservations.length} reservation${filteredReservations.length === 1 ? '' : 's'} to Excel.`);
    } catch (err: any) {
      setError(err.message || 'Failed to export the Excel file.');
    } finally {
      setExporting(false);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Please select a product from the search list.');
      return;
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity.');
      return;
    }
    const prod = products.find(p => p.product_id === parseInt(productId));
    if (!prod) {
      setError('Selected product not found.');
      return;
    }

    // Check if product is already in cart
    const existingIndex = cart.findIndex(item => item.product_id === prod.product_id);
    const existingQty = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    // Check stock availability
    if (prod.available < existingQty + qty) {
      setError(`Cannot add. Only ${prod.available} ${prod.unit} available in stock, and you already have ${existingQty} in the cart.`);
      return;
    }

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += qty;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        product_id: prod.product_id,
        product_name: prod.product_name,
        unit: prod.unit,
        quantity: qty,
        availableStock: prod.available
      }]);
    }

    // Reset selector
    setProductId('');
    setProductSearch('');
    setQuantity('1');
    setError(null);
  };

  // CREATE RESERVATION
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Please add at least one product to the reservation.');
      return;
    }
    const trimmedCustomer = customerName.trim();
    if (!trimmedCustomer) {
      setError('Customer name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
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

      // Double check stock levels in database to avoid race conditions
      const productIds = cart.map(item => item.product_id);
      const { data: dbProducts, error: dbProdErr } = await supabase
        .from('products')
        .select('product_id, stock, reserved_stock, product_name')
        .in('product_id', productIds);

      if (dbProdErr) throw dbProdErr;

      for (const item of cart) {
        const dbProd = dbProducts?.find(p => p.product_id === item.product_id);
        if (!dbProd) {
          throw new Error(`Product "${item.product_name}" not found in database.`);
        }
        const avail = dbProd.stock - dbProd.reserved_stock;
        if (item.quantity > avail) {
          throw new Error(`Insufficient stock for "${item.product_name}". Only ${avail} units available.`);
        }
      }

      // Prepare batch reservation inserts
      const reservationInserts = cart.map(item => ({
        customer_id: customerId,
        product_id: item.product_id,
        quantity: item.quantity,
        status: 'Pending'
      }));

      // Insert all reservations
      const { error: resErr } = await supabase.from('reservations').insert(reservationInserts);
      if (resErr) throw resErr;

      showSuccess('Reservation request submitted successfully.');
      setCustomerName('');
      setCart([]);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  // APPROVE RESERVATION (deducts stock and transitions to Approved)
  const handleApprove = async (resId: number, prodId: number, qty: number) => {
    if (!canApprove) {
      setError('Only Admins and Managers can approve reservations.');
      return;
    }
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
  const handleClaim = async (resId: number, prodId: number, qty: number, customerId: number) => {
    setActionId(resId); setError(null);
    try {
      // 1. Get product price
      const { data: prodData, error: prodErr } = await supabase.from('products').select('price, stock, reserved_stock').eq('product_id', prodId).single();
      if (prodErr) throw prodErr;

      const totalPrice = prodData.price * qty;

      // 2. Insert sale using the reservation's customer ID. Customer names are
      // encrypted at rest, so looking up an ID by the decrypted display name fails.
      const { error: saleErr } = await supabase.from('sales').insert({
        customer_id: customerId,
        product_id: prodId,
        quantity: qty,
        total_amount: totalPrice
      });
      if (saleErr) throw saleErr;

      // 3. Update product stock (deduct actual stock and release reserved stock)
      const { error: updateProdErr } = await supabase.from('products')
        .update({
          stock: prodData.stock - qty,
          reserved_stock: Math.max(0, prodData.reserved_stock - qty)
        }).eq('product_id', prodId);
      if (updateProdErr) throw updateProdErr;

      // 4. Update reservation status to Claimed
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
  const handleDelete = async () => {
    if (!reservationToDelete) return;

    const reservation = reservationToDelete;
    setActionId(reservation.reservation_id);
    setError(null);
    try {
      const { error: deleteErr } = await supabase.from('reservations').delete().eq('reservation_id', reservation.reservation_id);
      if (deleteErr) throw deleteErr;

      // If deleted while approved, release the reserved stock
      if (reservation.status === 'Approved') {
        const { data: prodData } = await supabase.from('products').select('reserved_stock').eq('product_id', reservation.product_id).single();
        if (prodData) {
          const newReserved = Math.max(0, prodData.reserved_stock - reservation.quantity);
          await supabase.from('products').update({ reserved_stock: newReserved }).eq('product_id', reservation.product_id);
        }
      }

      setReservations(currentReservations => currentReservations.filter(item => item.reservation_id !== reservation.reservation_id));
      setReservationToDelete(null);
      showSuccess('Reservation deleted.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete reservation.');
      setReservationToDelete(null);
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

  const { pageItems, pagination } = usePagination(filteredReservations, searchQuery + statusFilter);

  return (
    <div className="view-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div role="alert" className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div role="status" className="ui-alert ui-alert-success">{successMsg}</div>}

      {/* ── Dynamic Statistics Cards ── */}

      <div className="stats-grid">
        <StatCard label="Total reservations" value={error ? '—' : statsTotal} detail="All customer requests" icon={<FileText size={21} />} loading={loading} />
        <StatCard label="Approved" value={error ? '—' : statsApproved} detail="Ready for collection" icon={<CheckCircle size={21} />} loading={loading} />
        <StatCard label="Pending review" value={error ? '—' : statsPending} detail="Awaiting approval" icon={<Clock size={21} />} tone="amber" loading={loading} />
        <StatCard label="Cancelled" value={error ? '—' : statsCancelled} detail="Cancelled requests" icon={<XCircle size={21} />} tone="red" loading={loading} />
      </div>

      <ActionPanel title="New reservation" description="Reserve products for a customer to collect.">
        <form onSubmit={handleCreateReservation} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="reservations-field-1">Customer Name</label>
              <input id="reservations-field-1"
                type="text" className="form-input" placeholder="Name"
                value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'none' }} />
            <div style={{ display: 'none' }} />
          </div>

          <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
            <ProductPicker id="reservations-product" products={products} value={productId} query={productSearch}
              onQueryChange={setProductSearch} onSelect={product => { setProductId(product ? String(product.product_id) : ''); if (product) setProductSearch(product.product_name); }} />

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="reservations-quantity">Quantity</label>
              <input id="reservations-quantity" type="number" className="form-input" min="1" value={quantity} onChange={event => setQuantity(event.target.value)} required />
            </div>
            <button type="button" onClick={handleAddToCart} className="btn btn-secondary" style={{ height: '46px' }}>Add to cart</button>
          </div>

          {/* Cart Table */}
          {cart.length > 0 && (
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Selected Products to Reserve</h4>
              <div className="table-container cart-table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="custom-table cart-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th style={{ width: '50px', textAlign: 'center' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={`${item.product_id}-${idx}`}>
                        <td data-label="Product"><div>{item.product_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({item.unit})</span></div></td>
                        <td data-label="Quantity" style={{ fontWeight: 600 }}>{item.quantity}</td>
                        <td data-label="Remove" style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm delete-action-button"
                            onClick={() => {
                              setCart(cart.filter((_, i) => i !== idx));
                            }}
                            style={{ padding: '0.35rem' }}
                            title="Remove item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Items: </span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || cart.length === 0}
            style={{ height: '46px', alignSelf: 'flex-end', minWidth: '180px', marginTop: '0.5rem' }}
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Reserve Item(s)'}
          </button>
        </form>
      </ActionPanel>

      {/* ── Table Toolbar Controls: Search, Filter, Export ── */}
      <div className="mobile-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div className="toolbar-search" style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '380px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by customer or product..." aria-label="Search by customer or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        {/* Filter & Export */}
        <div className="toolbar-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toolbar-filter" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.45)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '0.2rem 0.75rem' }}>
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <select aria-label="Filter reservations by status"
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

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportExcel}
            disabled={filteredReservations.length === 0 || exporting}
            style={{ gap: '0.4rem', height: '38px', borderRadius: '16px' }}
            title="Export the listed reservations to Excel, sized to fit"
          >
            {exporting ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />} Export Excel
          </button>
        </div>
      </div>

      {/* ── Reservations Table ── */}
      <div className="glass-panel responsive-panel table-panel" style={{ padding: '1.5rem' }}>
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
                  <th style={{ width: '250px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((res) => (
                  <tr key={res.reservation_id}>
                    <td data-label="Customer Name"><strong style={{ color: 'var(--text-primary)' }}>{res.customer_name}</strong></td>
                    <td data-label="Reserved Item"><div>{res.product_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({res.unit})</span></div></td>
                    <td data-label="Quantity" style={{ fontWeight: 600 }}>{res.quantity}</td>
                    <td data-label="Date Requested" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(res.reservation_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td data-label="Status">
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
                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div className="table-row-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {/* Pending Actions */}
                        {res.status === 'Pending' && (
                          <>
                            {canApprove ? (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleApprove(res.reservation_id, res.product_id, res.quantity)}
                                disabled={actionId !== null}
                                style={{ gap: '0.2rem', padding: '0.35rem 0.75rem' }}
                                title="Approve Reservation"
                              >
                                {actionId === res.reservation_id ? <Loader2 className="animate-spin" size={12} /> : 'Approve'}
                              </button>
                            ) : (
                              <span
                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                                title="Only Admins and Managers can approve reservations"
                              >
                                <Lock size={12} /> Awaiting approval
                              </span>
                            )}
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
                              onClick={() => handleClaim(res.reservation_id, res.product_id, res.quantity, res.customer_id)}
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
                          className="btn btn-sm delete-action-button"
                          onClick={() => setReservationToDelete(res)}
                          disabled={actionId !== null}
                          style={{ padding: '0.45rem' }}
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
        <Pagination {...pagination} />
      </div>

      {reservationToDelete && (
        <Modal>
          <div className="modal-content delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-reservation-title">
            <div className="modal-header">
              <h3 id="delete-reservation-title" className="delete-confirm-title">
                <AlertTriangle size={18} /> Delete Reservation
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setReservationToDelete(null)}
                disabled={actionId !== null}
                aria-label="Close delete confirmation"
              >
                <X size={20} />
              </button>
            </div>
            <p className="delete-confirm-message">
              Permanently delete <strong>{reservationToDelete.customer_name}'s reservation</strong> for <strong>{reservationToDelete.quantity} {reservationToDelete.unit} of {reservationToDelete.product_name}</strong>? This cannot be undone.
            </p>
            <div className="delete-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setReservationToDelete(null)} disabled={actionId !== null}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={actionId !== null}>
                {actionId === reservationToDelete.reservation_id ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Reservations;
