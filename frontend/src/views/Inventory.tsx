import React, { useState, useEffect } from 'react';
import { Loader2, X, Plus, Edit2, Trash2, Search, AlertTriangle, Download } from 'lucide-react';
import { supabase } from '../supabaseClient';

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

  const handleDownloadCSV = () => {
    const headers = ['Product ID', 'Product Name', 'Unit Type', 'Price (PHP)', 'Total Stock', 'Reserved Stock', 'Available Stock'];
    const csvRows = [
      headers.join(','),
      ...products.map(p => [
        p.product_id,
        `"${p.product_name.replace(/"/g, '""')}"`,
        `"${p.unit.replace(/"/g, '""')}"`,
        p.price.toFixed(2),
        p.stock,
        p.reserved_stock,
        p.available
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PJP_Inventory_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products.filter(p => 
    p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.product_id.toString().includes(searchQuery)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div className="ui-alert ui-alert-success">{successMsg}</div>}

      {/* ── ADD PRODUCT — Premium inline layout ── */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
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
            onClick={handleDownloadCSV}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px' }}
          >
            <Download size={15} /> Export CSV
          </button>
        )}
      </div>

      {/* ── PRODUCTS TABLE ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
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
                  <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.product_id}>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>#{p.product_id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{p.product_name}</strong>
                        <span className="badge badge-info">{p.unit}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>₱{p.price.toFixed(2)}</td>
                    <td>
                      <span style={{ 
                        color: p.available <= 5 ? 'var(--danger)' : 'var(--text-primary)', 
                        fontWeight: p.available <= 5 ? 700 : 500 
                      }}>
                        {p.available}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.reserved_stock}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleOpenEdit(p)}
                          style={{ padding: '0.45rem' }}
                          title="Edit Product"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => setDeleteProduct(p)}
                          style={{ 
                            background: 'rgba(239, 68, 68, 0.12)', 
                            color: 'var(--danger)', 
                            border: '1px solid rgba(239, 68, 68, 0.22)',
                            padding: '0.45rem'
                          }}
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
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Edit Product</h3>
              <button className="modal-close" onClick={() => setEditProduct(null)}><X size={20} /></button>
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
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={18} /> Delete Product
              </h3>
              <button className="modal-close" onClick={() => setDeleteProduct(null)}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem', lineHeight: 1.6, fontSize: '0.92rem' }}>
              Are you sure you want to permanently delete <strong style={{ color: 'var(--text-primary)' }}>"{deleteProduct.product_name}"</strong>? This will remove the item from the registry.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteProduct(null)} disabled={deleting}>Cancel</button>
              <button
                type="button" className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleting}
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
