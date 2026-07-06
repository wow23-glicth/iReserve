/**
 * Field-Level Encryption Utility
 * Uses the Web Crypto API (AES-GCM, 256-bit) to encrypt and decrypt
 * sensitive customer PII data before it is written to or read from Supabase.
 *
 * The encryption key is loaded from the VITE_FIELD_ENCRYPTION_KEY environment
 * variable. Never commit the .env.local file to version control.
 */

const ENCRYPTION_KEY_B64 = import.meta.env.VITE_FIELD_ENCRYPTION_KEY || '';
const ALGORITHM = 'AES-GCM';
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt'];

// Converts a Base64 string to a CryptoKey usable by the Web Crypto API
async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: ALGORITHM }, false, KEY_USAGE);
}

/**
 * Encrypts a plaintext string using AES-GCM.
 * Returns a Base64-encoded string in the format: <iv_hex>:<ciphertext_base64>
 * The IV is randomly generated per encryption operation for semantic security.
 */
export async function encryptField(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY_B64) {
    console.warn('[Security] VITE_FIELD_ENCRYPTION_KEY is not set. Storing unencrypted.');
    return plaintext;
  }
  const key = await importKey(ENCRYPTION_KEY_B64);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
  return `${ivHex}:${cipherB64}`;
}

/**
 * Decrypts a ciphertext string produced by encryptField.
 * Returns the original plaintext. If the value does not match the
 * expected encrypted format, it is returned as-is (backward compatibility).
 */
export async function decryptField(ciphertext: string): Promise<string> {
  if (!ENCRYPTION_KEY_B64 || !ciphertext.includes(':')) {
    return ciphertext;
  }
  try {
    const [ivHex, cipherB64] = ciphertext.split(':');
    const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const cipherBuffer = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
    const key = await importKey(ENCRYPTION_KEY_B64);
    const plainBuffer = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, cipherBuffer);
    return new TextDecoder().decode(plainBuffer);
  } catch {
    // If decryption fails (e.g. plaintext record created before encryption), return raw
    return ciphertext;
  }
}

/**
 * Batch-decrypts an array of encrypted strings in parallel.
 */
export async function decryptFields(values: string[]): Promise<string[]> {
  return Promise.all(values.map(decryptField));
}
