import { supabase } from '../supabaseClient';
import { PRODUCT_PHOTO_BUCKET, ProductSaveError } from './productPhotos';

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const normalizePhotoMime = (file: File): { extension: string; mimeType: string } => {
  const ext = file.name ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  const type = (file.type || '').toLowerCase();

  if (type === 'image/png' || type === 'image/x-png' || ext === '.png') {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (type === 'image/webp' || ext === '.webp') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  return { extension: 'jpg', mimeType: 'image/jpeg' };
};

export const productPhotoStorage = {
  async upload(file: File): Promise<string> {
    const { extension, mimeType } = normalizePhotoMime(file);
    const path = `products/${generateUUID()}.${extension}`;
    const { error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).upload(path, file, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600'
    });
    if (error) {
      throw new Error(`Photo upload failed. Check your connection or ask an administrator to check photo storage. You can also remove the photo and save without it. (${error.message})`);
    }
    return path;
  },
  async remove(path: string): Promise<void> {
    const { error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).remove([path]);
    if (error) throw error;
  },
};

export async function productPhotoUrls(paths: string[]): Promise<{urls: Record<string, string>; failed: boolean}> {
  if (!paths.length) return { urls: {}, failed: false };
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const urls: Record<string, string> = {};
  const storagePaths: string[] = [];

  for (const p of uniquePaths) {
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:') || p.startsWith('/')) {
      urls[p] = p;
    } else {
      storagePaths.push(p);
    }
  }

  if (storagePaths.length > 0) {
    try {
      const { data, error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).createSignedUrls(storagePaths, 3600);
      if (!error && data) {
        for (const photo of data) {
          if (photo.path && photo.signedUrl) {
            urls[photo.path] = photo.signedUrl;
          }
        }
      }
    } catch {
      // Non-fatal, fallback to getPublicUrl below
    }

    // Fallback to getPublicUrl for any unresolved paths (e.g. if bucket is public or signed url failed)
    for (const p of storagePaths) {
      if (!urls[p]) {
        try {
          const { data } = supabase.storage.from(PRODUCT_PHOTO_BUCKET).getPublicUrl(p);
          if (data?.publicUrl) {
            urls[p] = data.publicUrl;
          }
        } catch {
          // Ignored
        }
      }
    }
  }

  const failed = storagePaths.some(p => !urls[p]);
  return { urls, failed };
}

export function productWriteError(error: {code?:string;message:string}): ProductSaveError {
  const missingPhotoColumn = error.code === 'PGRST204' || error.code === '42703';
  const message = missingPhotoColumn ? 'Product photos are not enabled in this workspace yet. Ask an administrator to finish setup, or remove the photo and save without it.' : error.message;
  // A transport failure can arrive after a committed write: keep that photo for recovery.
  const confirmedRejection = ['23514','23505','23503','23502','42501','42703','42P01','PGRST204','PGRST116'].includes(error.code || '');
  return new ProductSaveError(message, confirmedRejection);
}
