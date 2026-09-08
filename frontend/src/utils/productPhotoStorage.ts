import { supabase } from '../supabaseClient';
import { PRODUCT_PHOTO_BUCKET, ProductSaveError } from './productPhotos';

export const productPhotoStorage = {
  async upload(file: File): Promise<string> {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
    const path = `products/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).upload(path, file, { contentType:file.type, upsert:false, cacheControl:'3600' });
    if (error) throw new Error(`Photo upload failed. Check your connection or ask an administrator to check photo storage. You can also remove the photo and save without it. (${error.message})`);
    return path;
  },
  async remove(path: string): Promise<void> {
    const { error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).remove([path]);
    if (error) throw error;
  },
};

export async function productPhotoUrls(paths: string[]): Promise<{urls: Record<string, string>; failed: boolean}> {
  if (!paths.length) return {urls:{},failed:false};
  try {
    const { data, error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).createSignedUrls([...new Set(paths)], 3600);
    if (error) return {urls:{},failed:true};
    const urls: Record<string, string> = {};
    for (const photo of data || []) if (photo.path && photo.signedUrl) urls[photo.path] = photo.signedUrl;
    return {urls,failed:Object.keys(urls).length !== new Set(paths).size};
  } catch { return {urls:{},failed:true}; }
}

export function productWriteError(error: {code?:string;message:string}): ProductSaveError {
  const missingPhotoColumn = error.code === 'PGRST204' || error.code === '42703';
  const message = missingPhotoColumn ? 'Product photos are not enabled in this workspace yet. Ask an administrator to finish setup, or remove the photo and save without it.' : error.message;
  // A transport failure can arrive after a committed write: keep that photo for recovery.
  const confirmedRejection = ['23514','23505','23503','23502','42501','42703','42P01','PGRST204','PGRST116'].includes(error.code || '');
  return new ProductSaveError(message, confirmedRejection);
}
