import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface ProductOption { product_id: number; product_name: string; unit: string; available: number; }
interface Props {
  id: string; products: ProductOption[]; value: string; query: string;
  onQueryChange: (value: string) => void; onSelect: (product: ProductOption | null) => void;
}
export default function ProductPicker({ id, products, value, query, onQueryChange, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const options = products.filter(product => product.product_name.toLowerCase().includes(query.toLowerCase()));
  const choose = (product: ProductOption) => { onSelect(product); setOpen(false); setActive(-1); input.current?.focus(); };
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => { if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, id]);
  return <div ref={root} className="form-group product-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label className="form-label" htmlFor={id}>Search &amp; Select Product</label>
    <div className="input-with-icon"><Search size={17} />
      <input ref={input} id={id} className="form-input" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open}
        aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        placeholder="Search products by name…" value={query} onFocus={() => setOpen(true)}
        onChange={event => { onSelect(null); onQueryChange(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            const available = options.map((option, index) => option.available > 0 ? index : -1).filter(index => index >= 0);
            if (!available.length) return;
            const current = available.indexOf(active);
            const next = current < 0
              ? (event.key === 'ArrowDown' ? 0 : available.length - 1)
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length;
            setActive(available[next]);
          }
          if (event.key === 'Enter' && open && active >= 0 && options[active]?.available > 0) { event.preventDefault(); choose(options[active]); }
        }} />
      {value && <button type="button" className="picker-clear icon-button" aria-label="Clear selected product" onClick={() => { onSelect(null); onQueryChange(''); input.current?.focus(); }}><X size={16} /></button>}
    </div>
    {open && <div className="product-options" id={`${id}-options`} role="listbox" aria-label="Available products">
      {options.length ? options.map((product, index) => <div key={product.product_id} id={`${id}-option-${index}`} role="option"
        aria-selected={String(product.product_id) === value} aria-disabled={product.available <= 0}
        className={`product-option ${active === index ? 'is-active' : ''}`} onMouseDown={event => event.preventDefault()}
        onClick={() => { if (product.available > 0) choose(product); }}>
        <strong>{product.product_name}</strong><span>{product.available > 0 ? `${product.available} ${product.unit} left` : 'Out of stock'}</span>
      </div>) : <p className="picker-empty">No matching products. Try a different name.</p>}
    </div>}
  </div>;
}
