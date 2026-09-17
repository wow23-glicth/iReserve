import ProductPicker from '../components/ProductPicker';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import StatCard from '../components/StatCard';
import ActionPanel from '../components/ActionPanel';
import { availableStock } from '../utils/stock';
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Trash2, FileText, Search, Filter, FileSpreadsheet, Clock, AlertTriangle, X, Lock, Printer } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { encryptField, decryptField } from '../utils/crypto';
import { downloadExcel, parseDateOnly, type SheetData } from '../utils/excel';
import { formatPeso } from '../utils/sales';
import { generateUUID } from '../utils/productPhotoStorage';
import ReservationSlip from '../components/ReservationSlip';
import {
  type ReservationLineRecord,
  type ReservationTransaction,
  groupReservationLines
} from '../utils/reservations';

interface Product {
  product_id: number;
  product_name: string;
  unit: string;
  price: number;
  available: number;
}

interface CartItem {
  product_id: number;
  product_name: string;
  unit: string;
  price: number;
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

  const [rawReservations, setRawReservations] = useState<ReservationLineRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationTransaction[]>([]);
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

  // Loading states for actions
  const [actionId, setActionId] = useState<string | number | null>(null);
  const [reservationToDelete, setReservationToDelete] = useState<ReservationTransaction | null>(null);
  const [slipToPrint, setSlipToPrint] = useState<ReservationTransaction | null>(null);
  const [exporting, setExporting] = useState(false);

  // Multi-select bulk selection
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRes, prodRes] = await Promise.all([
        supabase.from('reservations').select('*, products(product_name, unit, price), customers(name)').order('reservation_id', { ascending: false }),
        supabase.from('products').select('*').order('product_name', { ascending: true })
      ]);
      if (resRes.error) throw resRes.error;
      if (prodRes.error) throw prodRes.error;

      const raw = resRes.data || [];
      const decryptedReservations: ReservationLineRecord[] = await Promise.all(
        raw.map(async (row: any) => ({
          reservation_id: row.reservation_id,
          transaction_id: row.transaction_id || null,
          customer_id: row.customer_id,
          customer_name: await decryptField(row.customers?.name || 'Unknown'),
          product_name: row.products?.product_name || 'Deleted Item',
          unit: row.products?.unit || '',
          price: parseFloat(row.products?.price || 0),
          quantity: parseInt(row.quantity),
          reservation_date: row.reservation_date,
          created_at: row.created_at || (row.reservation_date ? `${row.reservation_date}T00:00:00Z` : new Date().toISOString()),
          status: row.status,
          product_id: row.product_id
        }))
      );
      setRawReservations(decryptedReservations);
      setReservations(groupReservationLines(decryptedReservations));

      setProducts((prodRes.data || []).map((p: any) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        unit: p.unit,
        price: parseFloat(p.price || 0),
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

  // Excel Export — exports grouped reservation orders with item breakdown
  const handleExportExcel = async () => {
    setExporting(true);
    setError(null);

    try {
      const totalQuantity = filteredReservations.reduce((acc, r) => acc + r.total_quantity, 0);
      const totalEstimated = filteredReservations.reduce((acc, r) => acc + r.total_amount, 0);
      const rows: SheetData = [
        [
          { value: 'Reference Number', fontWeight: 'bold' },
          { value: 'Date Requested', fontWeight: 'bold' },
          { value: 'Customer', fontWeight: 'bold' },
          { value: 'Reserved Items', fontWeight: 'bold' },
          { value: 'Total Quantity', fontWeight: 'bold' },
          { value: 'Est. Total', fontWeight: 'bold' },
          { value: 'Status', fontWeight: 'bold' }
        ],
        ...filteredReservations.map(r => [
          { value: r.reservation_number, type: String },
          { value: parseDateOnly(r.reservation_date), type: Date, format: 'yyyy-mm-dd' },
          { value: r.customer_name, type: String },
          {
            value: r.items.map(item => `${item.product_name} (${item.unit}) × ${item.quantity}`).join('; '),
            type: String,
            wrap: true
          },
          { value: r.total_quantity, type: Number },
          { value: r.total_amount, type: Number, format: '#,##0.00' },
          { value: r.status, type: String }
        ]),
        [
          null,
          null,
          null,
          { value: 'TOTAL', fontWeight: 'bold' },
          { value: totalQuantity, type: Number, fontWeight: 'bold' },
          { value: totalEstimated, type: Number, format: '#,##0.00', fontWeight: 'bold' },
          null
        ]
      ];

      await downloadExcel(
        `reservations_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        [{ width: 26 }, { width: 14 }, { width: 22 }, { width: 48 }, { width: 14 }, { width: 18 }, { width: 14 }],
        rows
      );
      showSuccess(`Exported all ${filteredReservations.length} reservation order${filteredReservations.length === 1 ? '' : 's'} to Excel.`);
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
        price: prod.price,
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

  // CREATE BULK RESERVATION
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

      const transactionId = generateUUID();

      // Prepare batch reservation inserts with transaction_id
      const reservationInserts = cart.map(item => ({
        transaction_id: transactionId,
        customer_id: customerId,
        product_id: item.product_id,
        quantity: item.quantity,
        status: 'Pending'
      }));

      // Insert all reservations
      const { error: resErr } = await supabase.from('reservations').insert(reservationInserts);
      if (resErr) {
        // Fallback if transaction_id column not added to database yet
        if (resErr.code === 'PGRST204' || resErr.code === '42703') {
          const fallbackInserts = cart.map(item => ({
            customer_id: customerId,
            product_id: item.product_id,
            quantity: item.quantity,
            status: 'Pending'
          }));
          const { error: fallbackErr } = await supabase.from('reservations').insert(fallbackInserts);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw resErr;
        }
      }

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

  // APPROVE RESERVATION GROUP
  const handleApproveGroup = async (tx: ReservationTransaction) => {
    if (!canApprove) {
      setError('Only Admins and Managers can approve reservations.');
      return;
    }
    setActionId(tx.transaction_id);
    setError(null);

    try {
      const pendingItems = tx.items.filter(i => i.status === 'Pending');
      if (pendingItems.length === 0) {
        setError('No pending items to approve in this reservation.');
        return;
      }

      // Check stock for all pending items
      const productIds = pendingItems.map(i => i.product_id);
      const { data: dbProds, error: dbErr } = await supabase
        .from('products')
        .select('product_id, stock, reserved_stock, product_name, unit')
        .in('product_id', productIds);
      if (dbErr) throw dbErr;

      for (const item of pendingItems) {
        const prod = dbProds?.find(p => p.product_id === item.product_id);
        if (!prod) throw new Error(`Product "${item.product_name}" not found.`);
        const avail = prod.stock - prod.reserved_stock;
        if (item.quantity > avail) {
          throw new Error(`Cannot approve. Insufficient available stock for "${prod.product_name}" (only ${avail} ${prod.unit} left).`);
        }
      }

      // Update reservation status and product reserved_stock
      for (const item of pendingItems) {
        const prod = dbProds!.find(p => p.product_id === item.product_id)!;
        const { error: updateResErr } = await supabase
          .from('reservations')
          .update({ status: 'Approved' })
          .eq('reservation_id', item.reservation_id);
        if (updateResErr) throw updateResErr;

        const { error: updateProdErr } = await supabase
          .from('products')
          .update({ reserved_stock: prod.reserved_stock + item.quantity })
          .eq('product_id', item.product_id);
        if (updateProdErr) throw updateProdErr;
      }

      showSuccess(`Reservation ${tx.reservation_number} approved and stock reserved.`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve reservation.');
    } finally {
      setActionId(null);
    }
  };

  // CLAIM RESERVATION GROUP (converts entire approved reservation into a grouped Sale transaction)
  const handleClaimGroup = async (tx: ReservationTransaction) => {
    setActionId(tx.transaction_id);
    setError(null);

    try {
      const approvedItems = tx.items.filter(i => i.status === 'Approved');
      if (approvedItems.length === 0) {
        setError('Only approved reservations can be claimed.');
        return;
      }

      // 1. Fetch current products data
      const prodIds = approvedItems.map(i => i.product_id);
      const { data: dbProds, error: prodErr } = await supabase
        .from('products')
        .select('product_id, price, stock, reserved_stock')
        .in('product_id', prodIds);
      if (prodErr) throw prodErr;

      // 2. Insert grouped sale into sales with a shared transaction_id
      const saleTxId = generateUUID();
      const saleDate = new Date().toISOString().slice(0, 10);
      const saleRows = approvedItems.map(item => {
        const prod = dbProds?.find(p => p.product_id === item.product_id);
        const unitPrice = prod?.price ?? item.price ?? 0;
        return {
          transaction_id: saleTxId,
          customer_id: tx.customer_id,
          product_id: item.product_id,
          quantity: item.quantity,
          sale_date: saleDate,
          total_amount: unitPrice * item.quantity
        };
      });

      const { error: saleErr } = await supabase.from('sales').insert(saleRows);
      if (saleErr) {
        // Fallback without transaction_id if sales table is older
        if (saleErr.code === 'PGRST204' || saleErr.code === '42703') {
          const fallbackSaleRows = saleRows.map(({ transaction_id: _, ...rest }) => rest);
          const { error: fbErr } = await supabase.from('sales').insert(fallbackSaleRows);
          if (fbErr) throw fbErr;
        } else {
          throw saleErr;
        }
      }

      // 3. Update products stock and reserved_stock
      for (const item of approvedItems) {
        const prod = dbProds?.find(p => p.product_id === item.product_id);
        if (prod) {
          const { error: updateProdErr } = await supabase
            .from('products')
            .update({
              stock: prod.stock - item.quantity,
              reserved_stock: Math.max(0, prod.reserved_stock - item.quantity)
            })
            .eq('product_id', item.product_id);
          if (updateProdErr) throw updateProdErr;
        }
      }

      // 4. Update reservation status to Claimed
      const itemIds = approvedItems.map(i => i.reservation_id);
      const { error: updateResErr } = await supabase
        .from('reservations')
        .update({ status: 'Claimed' })
        .in('reservation_id', itemIds);
      if (updateResErr) throw updateResErr;

      showSuccess(`Reservation ${tx.reservation_number} claimed and converted to a Sale receipt.`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to claim reservation.');
    } finally {
      setActionId(null);
    }
  };

  // CANCEL RESERVATION GROUP
  const handleCancelGroup = async (tx: ReservationTransaction) => {
    setActionId(tx.transaction_id);
    setError(null);

    try {
      const cancellableItems = tx.items.filter(i => i.status === 'Pending' || i.status === 'Approved');
      if (cancellableItems.length === 0) {
        setError('No active items to cancel in this reservation.');
        return;
      }

      for (const item of cancellableItems) {
        // If it was Approved, release the reserved stock
        if (item.status === 'Approved') {
          const { data: prodData } = await supabase
            .from('products')
            .select('reserved_stock')
            .eq('product_id', item.product_id)
            .single();
          if (prodData) {
            const newReserved = Math.max(0, prodData.reserved_stock - item.quantity);
            await supabase.from('products').update({ reserved_stock: newReserved }).eq('product_id', item.product_id);
          }
        }

        const { error: updateResErr } = await supabase
          .from('reservations')
          .update({ status: 'Cancelled' })
          .eq('reservation_id', item.reservation_id);
        if (updateResErr) throw updateResErr;
      }

      showSuccess(`Reservation ${tx.reservation_number} cancelled.`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel reservation.');
    } finally {
      setActionId(null);
    }
  };

  // DELETE RESERVATION GROUP RECORD
  const handleDeleteGroup = async () => {
    if (!reservationToDelete) return;

    const tx = reservationToDelete;
    setActionId(tx.transaction_id);
    setError(null);

    try {
      // Release any approved reserved stock
      for (const item of tx.items) {
        if (item.status === 'Approved') {
          const { data: prodData } = await supabase
            .from('products')
            .select('reserved_stock')
            .eq('product_id', item.product_id)
            .single();
          if (prodData) {
            const newReserved = Math.max(0, prodData.reserved_stock - item.quantity);
            await supabase.from('products').update({ reserved_stock: newReserved }).eq('product_id', item.product_id);
          }
        }
      }

      const { error: deleteErr } = await supabase
        .from('reservations')
        .delete()
        .in('reservation_id', tx.reservation_ids);
      if (deleteErr) throw deleteErr;

      setReservationToDelete(null);
      showSuccess(`Reservation ${tx.reservation_number} deleted.`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete reservation.');
      setReservationToDelete(null);
    } finally {
      setActionId(null);
    }
  };

  // MULTI-ROW BATCH ACTIONS
  const handleToggleSelect = (txId: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(txId)) next.delete(txId);
    else next.add(txId);
    setSelectedTxIds(next);
  };

  const handleBulkApprove = async () => {
    if (!canApprove) return;
    const selected = reservations.filter(r => selectedTxIds.has(r.transaction_id));
    for (const tx of selected) {
      if (tx.status === 'Pending' || tx.items.some(i => i.status === 'Pending')) {
        await handleApproveGroup(tx);
      }
    }
    setSelectedTxIds(new Set());
  };

  const handleBulkClaim = async () => {
    const selected = reservations.filter(r => selectedTxIds.has(r.transaction_id));
    for (const tx of selected) {
      if (tx.status === 'Approved' || tx.items.some(i => i.status === 'Approved')) {
        await handleClaimGroup(tx);
      }
    }
    setSelectedTxIds(new Set());
  };

  const handleBulkCancel = async () => {
    const selected = reservations.filter(r => selectedTxIds.has(r.transaction_id));
    for (const tx of selected) {
      if (tx.status === 'Pending' || tx.status === 'Approved' || tx.items.some(i => i.status === 'Pending' || i.status === 'Approved')) {
        await handleCancelGroup(tx);
      }
    }
    setSelectedTxIds(new Set());
  };

  // Filter & Search Logic
  const filteredReservations = reservations.filter(r => {
    const matchesSearch = r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.reservation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.items.some(i => i.product_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter || (statusFilter === 'Pending' && r.items.some(i => i.status === 'Pending'));
    return matchesSearch && matchesStatus;
  });

  const { pageItems, pagination } = usePagination(filteredReservations, searchQuery + statusFilter);

  // Compute Reservation stats dynamically across grouped transactions
  const statsTotal = reservations.length;
  const statsApproved = reservations.filter(r => r.status === 'Approved').length;
  const statsPending = reservations.filter(r => r.status === 'Pending' || r.items.some(i => i.status === 'Pending')).length;
  const statsCancelled = reservations.filter(r => r.status === 'Cancelled').length;

  const allPageSelected = pageItems.length > 0 && pageItems.every(r => selectedTxIds.has(r.transaction_id));
  const hasSelectedPending = reservations.some(r => selectedTxIds.has(r.transaction_id) && (r.status === 'Pending' || r.items.some(i => i.status === 'Pending')));
  const hasSelectedApproved = reservations.some(r => selectedTxIds.has(r.transaction_id) && (r.status === 'Approved' || r.items.some(i => i.status === 'Approved')));
  const hasSelectedCancellable = reservations.some(r => selectedTxIds.has(r.transaction_id) && (r.status === 'Pending' || r.status === 'Approved' || r.items.some(i => i.status === 'Pending' || i.status === 'Approved')));

  const handleToggleSelectAll = () => {
    if (allPageSelected) {
      const next = new Set(selectedTxIds);
      pageItems.forEach(r => next.delete(r.transaction_id));
      setSelectedTxIds(next);
    } else {
      const next = new Set(selectedTxIds);
      pageItems.forEach(r => next.add(r.transaction_id));
      setSelectedTxIds(next);
    }
  };

  return (
    <div className="view-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div role="alert" className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div role="status" className="ui-alert ui-alert-success">{successMsg}</div>}

      {/* ── Dynamic Statistics Cards ── */}
      <div className="stats-grid">
        <StatCard label="Total reservations" value={error ? '—' : statsTotal} detail={`${rawReservations.reduce((sum, r) => sum + r.quantity, 0).toLocaleString()} units on request`} icon={<FileText size={21} />} loading={loading} />
        <StatCard label="Approved orders" value={error ? '—' : statsApproved} detail="Ready for customer collection" icon={<CheckCircle size={21} />} loading={loading} />
        <StatCard label="Pending review" value={error ? '—' : statsPending} detail="Awaiting approval" icon={<Clock size={21} />} tone="amber" loading={loading} />
        <StatCard label="Cancelled" value={error ? '—' : statsCancelled} detail="Cancelled orders" icon={<XCircle size={21} />} tone="red" loading={loading} />
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

          {/* Cart Table with Prices and Totals — matching Sales Cart */}
          {cart.length > 0 && (
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Selected Products to Reserve</h4>
              <div className="table-container cart-table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="custom-table cart-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Unit Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th style={{ width: '50px', textAlign: 'center' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={`${item.product_id}-${idx}`}>
                        <td data-label="Product"><div>{item.product_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({item.unit})</span></div></td>
                        <td data-label="Unit Price">{formatPeso(item.price)}</td>
                        <td data-label="Quantity" style={{ fontWeight: 600 }}>{item.quantity}</td>
                        <td data-label="Subtotal" style={{ fontWeight: 600 }}>{formatPeso(item.price * item.quantity)}</td>
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
              <div className="cart-summary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Items: </span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '0.5rem' }}>Est. Grand Total:</span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 800 }}>
                    {formatPeso(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
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
            placeholder="Search by customer, reference, or product..." aria-label="Search by customer, reference, or product..."
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

      {/* ── Grouped Reservations Table ── */}
      <div className="glass-panel responsive-panel table-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Reservation Orders</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Each row represents one reservation order with grouped items, matching Sales checkouts.
        </p>

        {/* Multi-Select Bulk Action Bar */}
        {selectedTxIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: 'rgba(36, 103, 71, 0.08)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{selectedTxIds.size}</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>order{selectedTxIds.size === 1 ? '' : 's'} selected</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {canApprove && hasSelectedPending && (
                <button type="button" className="btn btn-success btn-sm" onClick={handleBulkApprove} disabled={actionId !== null}>
                  Approve Selected
                </button>
              )}
              {hasSelectedApproved && (
                <button type="button" className="btn btn-primary btn-sm" onClick={handleBulkClaim} disabled={actionId !== null}>
                  Claim Selected
                </button>
              )}
              {hasSelectedCancellable && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleBulkCancel} disabled={actionId !== null}>
                  Cancel Selected
                </button>
              )}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedTxIds(new Set())}>
                Deselect All
              </button>
            </div>
          </div>
        )}

        {loading && reservations.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : filteredReservations.length > 0 ? (
          <div className="table-container">
            <table className="custom-table reservations-table sales-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all reservation orders on this page"
                      checked={allPageSelected}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Items Reserved</th>
                  <th>Total Quantity</th>
                  <th style={{ textAlign: 'center' }}>Est. Total</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ width: '220px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((res) => (
                  <tr key={res.transaction_id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        aria-label={`Select reservation ${res.reservation_number}`}
                        checked={selectedTxIds.has(res.transaction_id)}
                        onChange={() => handleToggleSelect(res.transaction_id)}
                      />
                    </td>
                    <td data-label="Reference" className="sales-receipt-reference">
                      <strong>{res.reservation_number}</strong>
                      <span>
                        {new Date(res.created_at || `${res.reservation_date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td data-label="Customer Name"><strong style={{ color: 'var(--text-primary)' }}>{res.customer_name}</strong></td>
                    <td data-label="Items Reserved">
                      <ul className="sale-line-items">
                        {res.items.map(item => (
                          <li key={item.reservation_id}>
                            <span>{item.product_name} <small>({item.unit})</small></span>
                            <strong>×{item.quantity}</strong>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td data-label="Total Quantity" style={{ fontWeight: 600 }}>{res.total_quantity}</td>
                    <td data-label="Est. Total" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                      {formatPeso(res.total_amount)}
                    </td>
                    <td data-label="Status" style={{ textAlign: 'center' }}>
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
                      <div className="table-row-actions" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary receipt-action-button"
                          onClick={() => setSlipToPrint(res)}
                          title={`Open slip for ${res.reservation_number}`}
                          aria-label={`Open printable reservation slip ${res.reservation_number}`}
                        >
                          <Printer size={14} /> Slip
                        </button>

                        {/* Pending Actions */}
                        {(res.status === 'Pending' || res.items.some(i => i.status === 'Pending')) && (
                          canApprove ? (
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => handleApproveGroup(res)}
                              disabled={actionId !== null}
                              style={{ gap: '0.2rem', padding: '0.35rem 0.75rem' }}
                              title="Approve reservation order"
                            >
                              {actionId === res.transaction_id ? <Loader2 className="animate-spin" size={12} /> : 'Approve'}
                            </button>
                          ) : (
                            <span
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                              title="Only Admins and Managers can approve reservations"
                            >
                              <Lock size={12} /> Awaiting approval
                            </span>
                          )
                        )}

                        {/* Approved Actions */}
                        {(res.status === 'Approved' || res.items.some(i => i.status === 'Approved')) && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleClaimGroup(res)}
                            disabled={actionId !== null}
                            style={{ padding: '0.35rem 0.75rem' }}
                            title="Claim order & convert to Sale"
                          >
                            {actionId === res.transaction_id ? <Loader2 className="animate-spin" size={12} /> : 'Claim'}
                          </button>
                        )}

                        {/* Cancel Action */}
                        {(res.status === 'Pending' || res.status === 'Approved' || res.items.some(i => i.status === 'Pending' || i.status === 'Approved')) && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCancelGroup(res)}
                            disabled={actionId !== null}
                            style={{ gap: '0.2rem', padding: '0.35rem 0.75rem' }}
                            title="Cancel reservation order"
                          >
                            Cancel
                          </button>
                        )}

                        {/* Delete Action */}
                        <button
                          type="button"
                          className="btn btn-sm delete-action-button"
                          onClick={() => setReservationToDelete(res)}
                          disabled={actionId !== null}
                          style={{ padding: '0.45rem' }}
                          title="Delete reservation order"
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

      {/* Delete Confirmation Modal */}
      {reservationToDelete && (
        <Modal>
          <div className="modal-content delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-reservation-title">
            <div className="modal-header">
              <h3 id="delete-reservation-title" className="delete-confirm-title">
                <AlertTriangle size={18} /> Delete Reservation Order
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
              Permanently delete <strong>{reservationToDelete.customer_name}'s reservation</strong> ({reservationToDelete.reservation_number}) with <strong>{reservationToDelete.total_quantity} item{reservationToDelete.total_quantity === 1 ? '' : 's'}</strong>? This cannot be undone.
            </p>
            <div className="delete-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setReservationToDelete(null)} disabled={actionId !== null}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteGroup} disabled={actionId !== null}>
                {actionId === reservationToDelete.transaction_id ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Reservation Slip Modal */}
      {slipToPrint && (
        <ReservationSlip
          reservation={slipToPrint}
          onClose={() => setSlipToPrint(null)}
        />
      )}
    </div>
  );
};

export default Reservations;
