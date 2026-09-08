export const PRODUCT_PHOTO_BUCKET = 'product-photos';
export const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;
export const PRODUCT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateProductPhoto(file: Pick<File, 'size' | 'type'>): void {
  if (!PRODUCT_PHOTO_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
  if (file.size === 0 || file.size > MAX_PRODUCT_PHOTO_BYTES) throw new Error('Choose a photo smaller than 5 MB.');
}

interface PhotoStorage {
  upload: (file: File) => Promise<string>;
  remove: (path: string) => Promise<void>;
}

/** A rejected database write is different from an unknown network outcome. */
export class ProductSaveError extends Error {
  confirmedRejection: boolean;
  constructor(message: string, confirmedRejection = false) { super(message); this.confirmedRejection = confirmedRejection; }
}

export async function saveWithProductPhoto({file, currentPath, removePhoto, save, storage}: {
  file: File | null; currentPath: string | null; removePhoto: boolean;
  save: (photoPath: string | null | undefined) => Promise<void>; storage: PhotoStorage;
}): Promise<boolean> {
  let uploadedPath: string | null = null;
  if (file) { validateProductPhoto(file); uploadedPath = await storage.upload(file); }
  try {
    // Undefined leaves the photo column untouched, including on older databases.
    await save(uploadedPath || (removePhoto ? null : undefined));
  } catch (error) {
    if (uploadedPath && error instanceof ProductSaveError && error.confirmedRejection) {
      try { await storage.remove(uploadedPath); }
      catch { throw new Error(`${error.message} The unused photo could not be removed; ask an administrator to check photo storage.`); }
    } else if (uploadedPath) {
      throw new Error('The product save could not be confirmed. Refresh Inventory before retrying. The uploaded photo was kept for recovery.');
    }
    throw error;
  }
  // Only delete the old photo after the new record value was confirmed saved.
  if (currentPath && (uploadedPath || removePhoto)) {
    try { await storage.remove(currentPath); } catch { return true; }
  }
  return false;
}
