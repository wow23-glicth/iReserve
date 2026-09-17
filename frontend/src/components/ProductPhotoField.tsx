import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { validateProductPhoto } from '../utils/productPhotos';

const verifyImageDecodable = async (file: File): Promise<void> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      return;
    } catch {
      // Fall through to Image element fallback
    }
  }
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as a photo. Choose a valid JPG, PNG, or WebP image.'));
    };
    img.src = url;
  });
};

export default function ProductPhotoField({id, file, existingUrl, hasExisting, removed, disabled, onFile, onRemove, onValidating}: {
  id: string; file: File | null; existingUrl?: string | null; hasExisting?: boolean; removed?: boolean; disabled: boolean;
  onFile: (file: File) => void; onRemove: () => void; onValidating: (value:boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) { setPreview(null); if (input.current) input.current.value = ''; return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const shownUrl = preview || (!removed ? existingUrl : null);
  return <div className="product-photo-field">
    <label className="form-label" htmlFor={id}>Product photo <span>(optional)</span></label>
    <div className="photo-picker-layout">
      <div
        className="photo-preview"
        onClick={() => { if (!disabled) input.current?.click(); }}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
        title="Click to select a photo"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); input.current?.click(); } }}
      >
        {shownUrl ? <img src={shownUrl} alt="Product photo preview" /> : <ImagePlus size={25} aria-hidden="true" />}
      </div>
      <div className="photo-picker-controls">
        <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp" disabled={disabled} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} aria-invalid={!!error}
          onChange={async event => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            onValidating(true);
            try {
              validateProductPhoto(selected);
              try { await verifyImageDecodable(selected); }
              catch { throw new Error('This file could not be read as a photo. Choose a valid JPG, PNG, or WebP image.'); }
              onFile(selected); setError('');
            } catch (err) { if (input.current) input.current.value = ''; setError(err instanceof Error ? err.message : 'Unable to use this photo.'); }
            finally { onValidating(false); }
          }} />
        <p id={`${id}-help`} className="field-help">JPG, PNG, or WebP · Up to 5 MB. You can leave this empty.</p>
        {file && <p className="photo-file-name">{file.name}</p>}
        {(file || (hasExisting && !removed)) && <button type="button" className="text-button photo-remove" disabled={disabled} onClick={() => { onRemove(); setError(''); }}><X size={14} /> Remove photo</button>}
        {removed && !file && <p className="field-help">The photo will be removed when you save.</p>}
        {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
      </div>
    </div>
  </div>;
}
