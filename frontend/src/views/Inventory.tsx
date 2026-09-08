import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import StatCard from '../components/StatCard';
import ActionPanel from '../components/ActionPanel';
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, X, Plus, Edit2, Trash2, Search, AlertTriangle, FileSpreadsheet, Coins, Package } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { downloadExcel, type SheetData } from '../utils/excel';
import ProductPhotoField from '../components/ProductPhotoField';
import ProductThumbnail from '../components/ProductThumbnail';
import { normalizeStockInput, parseStockInput, stockQuantity, availableStock, stockNeedsReview } from '../utils/stock';
import { saveWithProductPhoto } from '../utils/productPhotos';
import { productPhotoStorage, productPhotoUrls, productWriteError } from '../utils/productPhotoStorage';

interface Product {
  product_id: number;
  product_name: string;
  unit: string;
  price: number;
  stock: number;
  reserved_stock: number;
  available: number;
  needs_review: boolean;
  photo_path: string | null;
  photo_url: string | null;
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const saving = useRef(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [exporting, setExporting] = useState(false);

  // Add form
  const [addName, setAddName] = useState('');
  const [addUnit, setAddUnit] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addStock, setAddStock] = useState('');
  const [adding, setAdding] = useState(false);
  const [addPhoto, setAddPhoto] = useState<File | null>(null);
  const [photoValidating, setPhotoValidating] = useState(false);

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [updating, setUpdating] = useState(false);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [removeEditPhoto, setRemoveEditPhoto] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('products').select('*').order('product_id', { ascending: true });
      if (fetchError) throw fetchError;
      setLoadFailed(false);
      const photos = await productPhotoUrls((data || []).flatMap(p => p.photo_path ? [p.photo_path] : []));
      setPhotoWarning(photos.failed ? 'Some product photos could not be loaded. Inventory is still available. Refresh to retry.' : null);
      setProducts((data || []).map((p: any) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        unit: p.unit,
        price: parseFloat(p.price),
        stock: stockQuantity(p.stock),
        reserved_stock: stockQuantity(p.reserved_stock),
        available: availableStock(p.stock, p.reserved_stock),
        needs_review: stockNeedsReview(p.stock, p.reserved_stock),
        photo_path: p.photo_path || null,
        photo_url: photos.urls[p.photo_path] || null,
      })));
    } catch (err: any) {
      setLoadFailed(true);
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
    const refresh = window.setInterval(fetchProducts, 50 * 60 * 1000);
    return () => { supabase.removeChannel(channel); window.clearInterval(refresh); };
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // CREATE
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving.current || photoValidating) return;
    saving.current = true;
    setAdding(true); setError(null);
    try {
      const stock = parseStockInput(addStock);
      await saveWithProductPhoto({file:addPhoto,currentPath:null,removePhoto:false,storage:productPhotoStorage,
        save:async photoPath => {
          const { error: insertError } = await supabase.from('products').insert([{
            product_name: addName.trim(), unit: addUnit.trim() || 'pcs', price: parseFloat(addPrice), stock, reserved_stock: 0,
            ...(photoPath !== undefined ? {photo_path:photoPath} : {}),
          }]).select('product_id').single();
          if (insertError) throw productWriteError(insertError);
        },
      });
      showSuccess('Product added successfully.');
      setAddName(''); setAddUnit(''); setAddPrice(''); setAddStock(''); setAddPhoto(null);
      fetchProducts();
    } catch (err: any) { setError(err.message || 'Failed to add product.'); }
    finally { setAdding(false); saving.current = false; }
  };

  // UPDATE
  const handleOpenEdit = (p: Product) => {
    setEditProduct(p); setEditName(p.product_name);
    setEditUnit(p.unit); setEditPrice(p.price.toString()); setEditStock(p.stock.toString());
    setEditPhoto(null); setRemoveEditPhoto(false); setEditError(null);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct || saving.current || photoValidating) return;
    saving.current = true;
    setUpdating(true); setEditError(null);
    try {
      const stock = parseStockInput(editStock);
      // Read the latest reserved quantity; another staff member may have reserved units.
      const { data: current, error: readError } = await supabase.from('products').select('*').eq('product_id', editProduct.product_id).single();
      if (readError) throw productWriteError(readError);
      if (stock < stockQuantity(current.reserved_stock)) throw new Error(`There are ${stockQuantity(current.reserved_stock)} reserved units. Release or correct the reservations before reducing total stock below this quantity.`);
      if ((current.photo_path || null) !== editProduct.photo_path) throw new Error('This product photo changed while you were editing. Close and reopen the product before saving.');
      const cleanupWarning = await saveWithProductPhoto({file:editPhoto,currentPath:editProduct.photo_path,removePhoto:removeEditPhoto,storage:productPhotoStorage,
        save:async photoPath => {
          const query = supabase.from('products').update({
            product_name: editName.trim(), unit: editUnit.trim() || 'pcs', price: parseFloat(editPrice), stock,
            ...(photoPath !== undefined ? {photo_path:photoPath} : {}),
          }).eq('product_id', editProduct.product_id).eq('reserved_stock', current.reserved_stock).eq('stock', current.stock);
          if (photoPath !== undefined) {
            if (current.photo_path) query.eq('photo_path', current.photo_path);
            else query.is('photo_path', null);
          }
          const { error: updateError } = await query.select('product_id').single();
          if (updateError) throw productWriteError(updateError);
        },
      });
      showSuccess('Product updated successfully.');
      if (cleanupWarning) setError('Product saved, but the previous photo could not be removed from storage. Ask an administrator to clean up unused photos.');
      setEditProduct(null);
      fetchProducts();
    } catch (err: any) { setEditError(err.message || 'Failed to update product.'); }
    finally { setUpdating(false); saving.current = false; }
  };

  // DELETE
  const handleConfirmDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true); setError(null);
    try {
      const { error: deleteError } = await supabase.from('products')
        .delete().eq('product_id', deleteProduct.product_id).select('product_id').single();
      if (deleteError) throw deleteError;
      if (deleteProduct.photo_path) {
        try { await productPhotoStorage.remove(deleteProduct.photo_path); }
        catch { setError('Product deleted, but its photo could not be removed from storage. Ask an administrator to clean up unused photos.'); }
      }
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

  const filteredProducts = products.filter(p => {
    const matches = p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.product_id.toString().includes(searchQuery);
    return matches && (stockFilter === 'all' || (stockFilter === 'low' ? p.available <= 5 && p.available > 0 : stockFilter === 'out' ? p.available <= 0 : p.available > 5));
  }).sort((a,b) => sortBy === 'stock' ? a.available - b.available : a.product_name.localeCompare(b.product_name));
  const { pageItems, pagination } = usePagination(filteredProducts, searchQuery + stockFilter + sortBy);

  // Inventory valuation — what the stock on hand is worth at selling price.
  // Uses total stock, not available, so reserved units are still counted as
  // goods the store owns until they are actually claimed.
  const totalInventoryValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);

  return (
    <div className="view-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div role="alert" className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div role="status" className="ui-alert ui-alert-success">{successMsg}</div>}
      {photoWarning && <div role="status" className="ui-alert ui-alert-warning">{photoWarning}</div>}
      {products.some(p => p.needs_review) && <div role="status" className="ui-alert ui-alert-warning">Some stock records need review. Available quantities stop at 0. Check the counted stock and reserved quantities for the marked products.</div>}

      {/* ── Inventory Valuation Cards ── */}

      <div className="stats-grid">
        <StatCard label="Total inventory value" value={loadFailed ? '—' : '₱' + totalInventoryValue.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} detail="All stock at selling price" icon={<Coins size={21} />} loading={loading} />
        <StatCard label="Products listed" value={loadFailed ? '—' : products.length} detail={totalUnits.toLocaleString() + ' units on hand'} icon={<Package size={21} />} loading={loading} />
        <StatCard label="Low stock items" value={loadFailed ? '—' : products.filter(p => p.available <= 5).length} detail="5 or fewer available units" icon={<AlertTriangle size={21} />} tone="amber" loading={loading} />
      </div>

      <ActionPanel title="Add product" description="Add a new item to your inventory.">
        <form onSubmit={handleAddProduct} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="inventory-field-1">Product Name</label>
            <input id="inventory-field-1"
              type="text" className="form-input" placeholder="e.g. Copper Wire 12AWG"
              value={addName} onChange={(e) => setAddName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="inventory-field-2">Unit Type (optional)</label>
            <input id="inventory-field-2"
              type="text" className="form-input" placeholder="e.g. roll, box, pcs"
              value={addUnit} onChange={(e) => setAddUnit(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="inventory-field-3">Unit Price (₱)</label>
            <input id="inventory-field-3"
              type="number" min="0" step="0.01" className="form-input" placeholder="0.00"
              value={addPrice} onChange={(e) => setAddPrice(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="inventory-field-4">Initial Stock</label>
            <input id="inventory-field-4"
              type="number" min="0" className="form-input" placeholder="0"
              value={addStock} onChange={(e) => setAddStock(normalizeStockInput(e.target.value))}
              required
            />
          </div>

          <ProductPhotoField id="add-product-photo" file={addPhoto} disabled={adding || photoValidating} onFile={setAddPhoto} onRemove={() => setAddPhoto(null)} onValidating={setPhotoValidating} />
          <button type="submit" className="btn btn-primary" disabled={adding || photoValidating} style={{ height: '46px' }}>
            {adding ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Add Product</>}
          </button>
        </form>
      </ActionPanel>

      {/* ── Toolbar: Search ── */}
      <div className="mobile-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div className="toolbar-search" style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search inventory by name or ID..." aria-label="Search inventory by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        <div className="stock-filters">
          <select className="form-select" aria-label="Filter by stock" value={stockFilter} onChange={e => setStockFilter(e.target.value)}><option value="all">All stock levels</option><option value="healthy">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
          <select className="form-select" aria-label="Sort inventory" value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="name">Name A–Z</option><option value="stock">Low stock first</option></select>
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
                  <th>Available / Status</th>
                  <th>Reserved</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.product_id}>
                    <td data-label="Product ID" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>#{p.product_id}</td>
                    <td data-label="Product Details">
                      <div className="inventory-product-details">
                        <ProductThumbnail url={p.photo_url} name={p.product_name} />
                        <div className="table-value-group"><strong>{p.product_name}</strong><span className="badge badge-info">{p.unit}</span></div>
                      </div>
                    </td>
                    <td data-label="Unit Price" style={{ fontWeight: 600 }}>₱{p.price.toFixed(2)}</td>
                    <td data-label="Available Stock"><div className="stock-cell"><strong>{p.available}</strong><span className={'badge ' + (p.available <= 0 ? 'badge-danger' : p.available <= 5 ? 'badge-warning' : 'badge-success')}>{p.available <= 0 ? 'Out of stock' : p.available <= 5 ? 'Low stock' : 'In stock'}</span><span className="stock-detail">{p.stock} on hand</span>{p.needs_review && <span className="stock-review">Stock needs review</span>}</div></td>
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{products.length ? 'No products match these filters. Try another search or stock level.' : 'Your inventory is empty. Use Add product to create your first item.'}</p>
          </div>
        )}
        <Pagination {...pagination} />
      </div>

      {/* ── EDIT MODAL ── */}
      {editProduct && (
        <Modal>
          <div className="modal-content solid-modal" role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
            <div className="modal-header">
              <h3 id="edit-product-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Edit Product</h3>
              <button type="button" className="modal-close" onClick={() => setEditProduct(null)} disabled={updating || photoValidating} aria-label="Close edit product dialog"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateProduct}>
              {editError && <div role="alert" className="ui-alert ui-alert-error">{editError}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="inventory-field-5">Product Name</label>
                <input id="inventory-field-5" type="text" className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="inventory-field-6">Unit Type</label>
                <input id="inventory-field-6" type="text" className="form-input" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="inventory-field-7">Price (₱)</label>
                <input id="inventory-field-7" type="number" min="0" step="0.01" className="form-input" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="inventory-field-8">Total Stock</label>
                <input id="inventory-field-8" type="number" min="0" className="form-input" value={editStock} onChange={(e) => setEditStock(normalizeStockInput(e.target.value))} required />
                <p className="field-help">{editProduct.reserved_stock} reserved · Negative input becomes 0.</p>
              </div>
              <ProductPhotoField id="edit-product-photo" file={editPhoto} existingUrl={editProduct.photo_url} hasExisting={!!editProduct.photo_path} removed={removeEditPhoto} disabled={updating || photoValidating} onFile={file => { setEditPhoto(file); setRemoveEditPhoto(false); }} onRemove={() => { setEditPhoto(null); setRemoveEditPhoto(true); }} onValidating={setPhotoValidating} />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditProduct(null)} disabled={updating || photoValidating}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={updating || photoValidating}>
                  {updating ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteProduct && (
        <Modal>
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
                type="button" className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleting}
              >
                {deleting ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Inventory;
