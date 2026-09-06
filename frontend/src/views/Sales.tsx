import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Coins, Search, ShoppingBag, FileSpreadsheet, ArrowUpRight, Trash2, AlertTriangle, Printer, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { encryptField, decryptField } from '../utils/crypto';
import { downloadExcel, parseDateOnly, type SheetData } from '../utils/excel';
import SalesReceipt from '../components/SalesReceipt';
import { formatPeso, groupSaleLines, type SaleLineRecord, type SaleTransaction } from '../utils/sales';

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

interface SalesProps {
  role: string;
}

const Sales: React.FC<SalesProps> = ({ role }) => {
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [saleToDelete, setSaleToDelete] = useState<SaleTransaction | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<SaleTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Clearing the whole ledger is irreversible, so it is typed-to-confirm
  const [showClearHistory, setShowClearHistory] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Cart & Search combobox states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

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
       const decryptedSales: SaleLineRecord[] = await Promise.all(
         rawSales.map(async (row: any) => ({
           sale_id: row.sale_id,
           transaction_id: row.transaction_id || null,
           product_id: row.product_id,
           customer_name: await decryptField(row.customers?.name || 'Unknown'),
           product_name: row.products?.product_name || 'Deleted Item',
           unit: row.products?.unit || '',
           quantity: parseInt(row.quantity),
           sale_date: row.sale_date,
           created_at: row.created_at || `${row.sale_date}T00:00:00Z`,
           total_amount: parseFloat(row.total_amount)
         }))
       );
       setSales(groupSaleLines(decryptedSales));

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

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (cart.length === 0) {
      setError('Please add at least one product to the sale.');
      return;
    }
    const trimmedCustomer = customerName.trim();
    if (!trimmedCustomer) {
      setError('Customer name is required.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const submittedCart = cart.map(item => ({ ...item }));

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

      const transactionId = crypto.randomUUID();
      const { data: recordedRows, error: saleError } = await supabase.rpc('record_sale_transaction', {
        p_customer_id: customerId,
        p_transaction_id: transactionId,
        p_items: submittedCart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      });

      if (saleError) {
        const migrationMissing = saleError.code === 'PGRST202' || saleError.message?.includes('record_sale_transaction');
        if (migrationMissing) {
          throw new Error('Sales transaction setup is not installed. Run sales_transaction_upgrade.sql in the Supabase SQL Editor, then try again.');
        }
        throw saleError;
      }

      const receiptLines: SaleLineRecord[] = (recordedRows || []).map((row: any) => {
        const item = submittedCart.find(cartItem => cartItem.product_id === Number(row.product_id));
        return {
          sale_id: Number(row.sale_id),
          transaction_id: row.transaction_id || transactionId,
          product_id: Number(row.product_id),
          customer_name: trimmedCustomer,
          product_name: item?.product_name || 'Product',
          unit: item?.unit || 'unit',
          quantity: Number(row.quantity),
          sale_date: row.sale_date,
          created_at: row.created_at || new Date().toISOString(),
          total_amount: Number(row.total_amount)
        };
      });
      const recordedTransaction = groupSaleLines(receiptLines)[0];
      if (!recordedTransaction) throw new Error('The sale was saved, but the receipt data could not be loaded. Check the transaction log before trying again.');

      showSuccess('Sale recorded as one transaction. Receipt ready to print.');
      setCustomerName('');
      setCart([]);
      setReceiptToPrint(recordedTransaction);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to record sale.');
    } finally {
      submittingRef.current = false;
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
        .in('sale_id', saleToDelete.sale_ids)
        .select('sale_id');

      if (deleteError) throw deleteError;
      if (!deletedRows?.length) throw new Error('This sale could not be deleted. Administrator access is required.');

      if (deletedRows.length !== saleToDelete.sale_ids.length) {
        throw new Error('Only part of this transaction was deleted. Refresh the records before making another change.');
      }

      setSales(currentSales => currentSales.filter(sale => sale.transaction_id !== saleToDelete.transaction_id));
      setSaleToDelete(null);
      showSuccess('Sale transaction deleted successfully.');
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

      const transactionCount = sales.length;
      setSales([]);
      setShowClearHistory(false);
      setClearConfirmText('');
      showSuccess(`Deleted all ${transactionCount} sale transaction${transactionCount === 1 ? '' : 's'}.`);
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
          { value: 'Receipt Number', fontWeight: 'bold' },
          { value: 'Date', fontWeight: 'bold' },
          { value: 'Customer', fontWeight: 'bold' },
          { value: 'Items', fontWeight: 'bold' },
          { value: 'Total Quantity', fontWeight: 'bold' },
          { value: 'Transaction Total', fontWeight: 'bold' }
        ],
        ...sales.map(s => [
          { value: s.receipt_number, type: String },
          { value: parseDateOnly(s.sale_date), type: Date, format: 'yyyy-mm-dd' },
          { value: s.customer_name, type: String },
          {
            value: s.items.map(item => `${item.product_name} (${item.unit}) × ${item.quantity}`).join('; '),
            type: String,
            wrap: true
          },
          { value: s.total_quantity, type: Number },
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
        [{ width: 26 }, { width: 14 }, { width: 22 }, { width: 48 }, { width: 14 }, { width: 18 }],
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
    s.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Whole-ledger totals — shown on the stat card and written to the Excel export
  const totalSalesRevenue = sales.reduce((acc, curr) => acc + curr.total_amount, 0);
  const totalSalesQuantity = sales.reduce((acc, s) => acc + s.total_quantity, 0);

  // Totals for the rows currently on screen, which the table footer reports
  const filteredTotalQuantity = filteredSales.reduce((acc, s) => acc + s.total_quantity, 0);
  const filteredTotalAmount = filteredSales.reduce((acc, s) => acc + s.total_amount, 0);

  // Filter products for searchable dropdown
  const filteredProducts = products.filter(p =>
    p.product_name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="view-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
      <div className="glass-panel responsive-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Record New Sale</h3>
        <form onSubmit={handleRecordSale} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Customer Name</label>
              <input
                type="text" className="form-input" placeholder="Name"
                value={customerName} onChange={(e) => setCustomerName(e.target.value)} required
              />
            </div>
            <div style={{ display: 'none' }} />
            <div style={{ display: 'none' }} />
          </div>

          <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
              <label className="form-label">Search & Select Product</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type to search..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductId('');
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  style={{ paddingRight: '2.2rem' }}
                />
                {productId && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductId('');
                      setProductSearch('');
                    }}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                    title="Clear selection"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {showDropdown && (
                <>
                  <div 
                    onClick={() => setShowDropdown(false)} 
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 40,
                      background: 'transparent'
                    }}
                  />
                  <div
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 50,
                      background: 'rgba(255, 255, 255, 0.98)',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: '0.4rem 0'
                    }}
                  >
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(p => (
                        <button
                          key={p.product_id}
                          type="button"
                          onClick={() => {
                            setProductId(p.product_id.toString());
                            setProductSearch(p.product_name);
                            setShowDropdown(false);
                          }}
                          disabled={p.available <= 0}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.6rem 1rem',
                            background: 'transparent',
                            border: 'none',
                            color: p.available > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                            cursor: p.available > 0 ? 'pointer' : 'not-allowed',
                            fontSize: '0.9rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (p.available > 0) {
                              e.currentTarget.style.background = 'rgba(102, 117, 107, 0.08)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{p.product_name}</span>
                          <span style={{ fontSize: '0.78rem', color: p.available > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                            {p.available > 0 ? `${p.available} ${p.unit} left` : 'Out of Stock'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
                        No matching products
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>

            <button type="button" onClick={handleAddToCart} className="btn btn-secondary" style={{ height: '46px' }}>
              Add to List
            </button>
          </div>

          {/* Cart Table */}
          {cart.length > 0 && (
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Selected Products</h4>
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
                        <td data-label="Product">{item.product_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({item.unit})</span></td>
                        <td data-label="Unit Price">₱{item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td data-label="Quantity" style={{ fontWeight: 600 }}>{item.quantity}</td>
                        <td data-label="Subtotal" style={{ fontWeight: 600 }}>₱{(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '0.5rem' }}>Grand Total:</span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 800 }}>
                    ₱{cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Process Sale'}
          </button>
        </form>
      </div>

      {/* ── Toolbar: Search & Export ── */}
      <div className="mobile-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="toolbar-search" style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
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

        <div className="toolbar-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
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

      {/* ── Grouped Transactions Table ── */}
      <div className="glass-panel responsive-panel table-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Sales Records</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Each row is one checkout and can be reopened as a printable receipt.
        </p>
        {loading && sales.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : filteredSales.length > 0 ? (
          <div className="table-container">
            <table className="custom-table sales-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Items Purchased</th>
                  <th>Total Quantity</th>
                  <th style={{ textAlign: 'center' }}>Total Paid</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.transaction_id}>
                    <td data-label="Receipt" className="sales-receipt-reference">
                      <strong>{sale.receipt_number}</strong>
                      <span>
                        {new Date(`${sale.sale_date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td data-label="Customer Name"><strong style={{ color: 'var(--text-primary)' }}>{sale.customer_name}</strong></td>
                    <td data-label="Items Purchased">
                      <ul className="sale-line-items">
                        {sale.items.map(item => (
                          <li key={item.sale_id}>
                            <span>{item.product_name} <small>({item.unit})</small></span>
                            <strong>×{item.quantity}</strong>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td data-label="Total Quantity" style={{ fontWeight: 600 }}>{sale.total_quantity}</td>
                    <td data-label="Total Paid" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                      {formatPeso(sale.total_amount)}
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div className="table-row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary receipt-action-button"
                          onClick={() => setReceiptToPrint(sale)}
                          title={`Open receipt ${sale.receipt_number}`}
                          aria-label={`Open printable receipt ${sale.receipt_number}`}
                        >
                          <Printer size={14} /> Receipt
                        </button>
                        {role === 'Admin' && (
                        <button
                          type="button"
                          className="btn btn-sm delete-action-button"
                          onClick={() => setSaleToDelete(sale)}
                          disabled={deleting}
                          style={{ padding: '0.45rem' }}
                          title="Delete sale transaction"
                          aria-label={`Delete sale transaction ${sale.receipt_number}`}
                        >
                          <Trash2 size={13} />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td data-label="Summary" colSpan={3} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                    TOTAL{searchQuery ? ' (filtered)' : ''}
                  </td>
                  <td data-label="Total Quantity" style={{ fontWeight: 700 }}>{filteredTotalQuantity}</td>
                  <td data-label="Total Amount" style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                    ₱{filteredTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No sales records match your criteria.</p>
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
              This permanently deletes <strong>all {sales.length} sale transaction{sales.length === 1 ? '' : 's'}</strong>, worth{' '}
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
                <AlertTriangle size={18} /> Delete Sale Transaction
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
              Permanently delete receipt <strong>{saleToDelete.receipt_number}</strong> for <strong>{saleToDelete.customer_name}</strong>,
              including all {saleToDelete.items.length} line item{saleToDelete.items.length === 1 ? '' : 's'} worth <strong>{formatPeso(saleToDelete.total_amount)}</strong>? This cannot be undone.
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

      {receiptToPrint && (
        <SalesReceipt sale={receiptToPrint} onClose={() => setReceiptToPrint(null)} />
      )}
    </div>
  );
};

export default Sales;
