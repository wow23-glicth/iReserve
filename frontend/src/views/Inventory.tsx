import React, { useState, useEffect } from 'react';
import { Loader2, X, Plus, Edit2, Trash2, Search, AlertTriangle, FileSpreadsheet, Coins, Package } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { downloadExcel, type SheetData } from '../utils/excel';

interface Product {
  product_id: number;
  product_name: string;
  unit: string;
  price: number;
  stock: number;
  reserved_stock: number;
  available: number;
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // Add form
  const [addName, setAddName] = useState('');
  const [addUnit, setAddUnit] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addStock, setAddStock] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete confirmation
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('products').select('*').order('product_id', { ascending: true });
      if (fetchError) throw fetchError;
      setProducts((data || []).map((p: any) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        unit: p.unit,
        price: parseFloat(p.price),
        stock: parseInt(p.stock),
        reserved_stock: parseInt(p.reserved_stock),
        available: parseInt(p.stock) - parseInt(p.reserved_stock),
      })));
    } catch (err: any) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const channel = supabase.channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // CREATE
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true); setError(null);
    try {
      const { error: insertError } = await supabase.from('products').insert([{
        product_name: addName,
        unit: addUnit.trim() || 'pcs',
        price: parseFloat(addPrice),
        stock: parseInt(addStock),
        reserved_stock: 0
      }]);
      if (insertError) throw insertError;
      showSuccess('Product added successfully.');
      setAddName(''); setAddUnit(''); setAddPrice(''); setAddStock('');
      fetchProducts();
    } catch (err: any) { setError(err.message || 'Failed to add product.'); }
    finally { setAdding(false); }
  };

  // UPDATE
  const handleOpenEdit = (p: Product) => {
    setEditProduct(p); setEditName(p.product_name);
    setEditUnit(p.unit); setEditPrice(p.price.toString()); setEditStock(p.stock.toString());
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setUpdating(true); setError(null);
    try {
      const { error: updateError } = await supabase.from('products')
        .update({ 
          product_name: editName, 
          unit: editUnit.trim() || 'pcs', 
          price: parseFloat(editPrice), 
          stock: parseInt(editStock) 
        })
        .eq('product_id', editProduct.product_id);
      if (updateError) throw updateError;
      showSuccess('Product updated successfully.');
      setEditProduct(null);
      fetchProducts();
    } catch (err: any) { setError(err.message || 'Failed to update product.'); }
    finally { setUpdating(false); }
  };

  // DELETE
  const handleConfirmDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true); setError(null);
    try {
      const { error: deleteError } = await supabase.from('products')
        .delete().eq('product_id', deleteProduct.product_id);
      if (deleteError) throw deleteError;
      showSuccess(`"${deleteProduct.product_name}" deleted.`);
      setDeleteProduct(null);
      fetchProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product.');
      setDeleteProduct(null);
    } finally { setDeleting(false); }
  };

  const handleDownloadExcel = async () => {
    setExporting(true);

    try {
      const rows: SheetData = [
        [
          { value: 'Product ID', fontWeight: 'bold' },
          { value: 'Product Name', fontWeight: 'bold' },
          { value: 'Unit Type', fontWeight: 'bold' },
          { value: 'Price (PHP)', fontWeight: 'bold' },
          { value: 'Total Stock', fontWeight: 'bold' },
          { value: 'Reserved Stock', fontWeight: 'bold' },
          { value: 'Available Stock', fontWeight: 'bold' },
          { value: 'Stock Value (PHP)', fontWeight: 'bold' }
        ],
        ...products.map(p => [
          { value: p.product_id, type: Number },
          { value: p.product_name, type: String },
          { value: p.unit, type: String },
          { value: p.price, type: Number, format: '#,##0.00' },
          { value: p.stock, type: Number },
          { value: p.reserved_stock, type: Number },
          { value: p.available, type: Number },
          { value: p.price * p.stock, type: Number, format: '#,##0.00' }
        ]),
        // Unit prices are deliberately not summed — a total of prices under a
        // Price heading would be a meaningless figure. Stock Value is summed
        // instead, and matches the Total Inventory Value card on screen.
        [
          null,
          { value: 'TOTAL', fontWeight: 'bold' },
          null,
          null,
          { value: products.reduce((acc, p) => acc + p.stock, 0), type: Number, fontWeight: 'bold' },
          { value: products.reduce((acc, p) => acc + p.reserved_stock, 0), type: Number, fontWeight: 'bold' },
          { value: products.reduce((acc, p) => acc + p.available, 0), type: Number, fontWeight: 'bold' },
          { value: totalInventoryValue, type: Number, format: '#,##0.00', fontWeight: 'bold' }
        ]
      ];

      await downloadExcel(
        `PJP_Inventory_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
        [{ width: 12 }, { width: 30 }, { width: 13 }, { width: 14 }, { width: 13 }, { width: 15 }, { width: 16 }, { width: 18 }],
        rows
      );
    } catch (err: any) {
      setError(err.message || 'Failed to export the Excel file.');
    } finally {
      setExporting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.product_id.toString().includes(searchQuery)
  );

  // Inventory valuation — what the stock on hand is worth at selling price.
  // Uses total stock, not available, so reserved units are still counted as
  // goods the store owns until they are actually claimed.
  const totalInventoryValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);

  return (
    <div className="view-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div className="ui-alert ui-alert-success">{successMsg}</div>}

      {/* ── Inventory Valuation Cards ── */}
      <div className="stats-grid">
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Total Inventory Value
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ₱{totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All stock at selling price</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', color: '#22C55E', justifyContent: 'center' }}>
            <Coins size={20} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Products Listed
            </p>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{products.length}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {totalUnits.toLocaleString()} unit{totalUnits === 1 ? '' : 's'} on hand
            </span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', color: 'var(--primary)', justifyContent: 'center' }}>
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* ── ADD PRODUCT — Premium inline layout ── */}
      <div className="glass-panel responsive-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Add New Product</h3>
        <form onSubmit={handleAddProduct} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Product Name</label>
            <input
              type="text" className="form-input" placeholder="e.g. Copper Wire 12AWG"
              value={addName} onChange={(e) => setAddName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Unit Type (optional)</label>
            <input
              type="text" className="form-input" placeholder="e.g. roll, box, pcs"
              value={addUnit} onChange={(e) => setAddUnit(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Unit Price (₱)</label>
            <input
              type="number" step="0.01" className="form-input" placeholder="0.00"
              value={addPrice} onChange={(e) => setAddPrice(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Initial Stock</label>
            <input
              type="number" className="form-input" placeholder="0"
              value={addStock} onChange={(e) => setAddStock(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={adding} style={{ height: '46px' }}>
            {adding ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Add Product</>}
          </button>
        </form>
      </div>

      {/* ── Toolbar: Search ── */}
      <div className="mobile-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div className="toolbar-search" style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search inventory by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        {products.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={exporting}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px' }}
            title="Export the full inventory to Excel, sized to fit"
          >
            {exporting ? <Loader2 className="animate-spin" size={15} /> : <FileSpreadsheet size={15} />} Export Excel
          </button>
        )}
      </div>

      {/* ── PRODUCTS TABLE ── */}
      <div className="glass-panel responsive-panel table-panel" style={{ padding: '1.5rem' }}>
        {loading && products.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="table-container">
            <table className="custom-table inventory-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Product Details</th>
                  <th>Price</th>
                  <th>Available Stock</th>
                  <th>Reserved</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.product_id}>
                    <td data-label="Product ID" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>#{p.product_id}</td>
                    <td data-label="Product Details">
                      <div className="table-value-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{p.product_name}</strong>
                        <span className="badge badge-info">{p.unit}</span>
                      </div>
                    </td>
                    <td data-label="Unit Price" style={{ fontWeight: 600 }}>₱{p.price.toFixed(2)}</td>
                    <td data-label="Available Stock">
                      <span style={{ 
                        color: p.available <= 5 ? 'var(--danger)' : 'var(--text-primary)', 
                        fontWeight: p.available <= 5 ? 700 : 500 
                      }}>
                        {p.available}
                      </span>
                    </td>
                    <td data-label="Reserved Qty" style={{ color: 'var(--text-secondary)' }}>{p.reserved_stock}</td>
                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div className="table-row-actions" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleOpenEdit(p)}
                          style={{ padding: '0.45rem' }}
                          title="Edit Product"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-sm delete-action-button"
                          onClick={() => setDeleteProduct(p)}
                          style={{ padding: '0.45rem' }}
                          title="Delete Product"
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No products match your search.</p>
          </div>
        )}
      </div>

      {/* ── EDIT MODAL ── */}
      {editProduct && (
        <div className="modal-overlay">
          <div className="modal-content solid-modal" role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
            <div className="modal-header">
              <h3 id="edit-product-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Edit Product</h3>
              <button type="button" className="modal-close" onClick={() => setEditProduct(null)} disabled={updating} aria-label="Close edit product dialog"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateProduct}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input type="text" className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Type</label>
                <input type="text" className="form-input" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Price (₱)</label>
                <input type="number" step="0.01" className="form-input" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Total Stock</label>
                <input type="number" className="form-input" value={editStock} onChange={(e) => setEditStock(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditProduct(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteProduct && (
        <div className="modal-overlay">
          <div className="modal-content delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
            <div className="modal-header">
              <h3 id="delete-product-title" className="delete-confirm-title">
                <AlertTriangle size={18} /> Delete Product
              </h3>
              <button type="button" className="modal-close" onClick={() => setDeleteProduct(null)} disabled={deleting} aria-label="Close delete confirmation"><X size={20} /></button>
            </div>
            <p className="delete-confirm-message">
              Are you sure you want to permanently delete <strong style={{ color: 'var(--text-primary)' }}>"{deleteProduct.product_name}"</strong>? This will remove the item from the registry.
            </p>
            <div className="delete-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteProduct(null)} disabled={deleting}>Cancel</button>
              <button
                type="button" className="btn btn-primary" onClick={handleConfirmDelete} disabled={deleting}
              >
                {deleting ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
