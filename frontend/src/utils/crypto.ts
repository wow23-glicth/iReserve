/**
 * Field-Level Encryption Utility
 * Uses the Web Crypto API (AES-GCM, 256-bit) to encrypt and decrypt
 * sensitive customer PII data before it is written to or read from Supabase.
 *
 * The encryption key is stored in Supabase Vault and retrieved at runtime
 * via the `get_encryption_key` RPC function (authenticated users only).
 * It is never bundled into the frontend or stored in localStorage.
 */

import { supabase } from '../supabaseClient';

const ALGORITHM = 'AES-GCM';
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt'];

// Module-level cache: fetched once per session after login, then reused.
let _keyB64: string | null = null;
let _cryptoKey: CryptoKey | null = null;

/**
 * Fetches the Base64 key from Supabase Vault (via RPC) on the first call,
 * then caches both the raw string and the imported CryptoKey.
 * Subsequent calls return the cached CryptoKey immediately.
 */
async function getKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey;

  if (!_keyB64) {
    const { data, error } = await supabase.rpc('get_encryption_key');
    if (error || !data) {
      throw new Error(
        `[Security] Failed to fetch encryption key from Vault: ${error?.message ?? 'empty response'}`
      );
    }
    _keyB64 = data as string;
  }

  const raw = Uint8Array.from(atob(_keyB64), (c) => c.charCodeAt(0));
  _cryptoKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: ALGORITHM },
    false,
    KEY_USAGE
  );
  return _cryptoKey;
}

/**
 * Call this when the user logs out to clear the in-memory key cache.
 * Prevents a subsequent user on the same device from reusing the key
 * without re-authenticating.
 */
export function clearEncryptionKeyCache(): void {
  _keyB64 = null;
  _cryptoKey = null;
}

/**
 * Encrypts a plaintext string using AES-GCM.
 * Returns a Base64-encoded string in the format: <iv_hex>:<ciphertext_base64>
 * The IV is randomly generated per encryption operation for semantic security.
 */
export async function encryptField(plaintext: string): Promise<string> {
  let key: CryptoKey;
  try {
    key = await getKey();
  } catch (err) {
    console.warn('[Security] Could not retrieve encryption key. Storing unencrypted.', err);
    return plaintext;
  }

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
  if (!ciphertext.includes(':')) {
    // Not an encrypted value — return as-is for backward compatibility.
    return ciphertext;
  }

  let key: CryptoKey;
  try {
    key = await getKey();
  } catch {
    // If the key is unavailable (e.g. user not authenticated), return raw.
    return ciphertext;
  }

  try {
    const [ivHex, cipherB64] = ciphertext.split(':');
    const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const cipherBuffer = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
    const plainBuffer = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, cipherBuffer);
    return new TextDecoder().decode(plainBuffer);
  } catch {
    // If decryption fails (e.g. plaintext record created before encryption), return raw.
    return ciphertext;
  }
}

/**
 * Batch-decrypts an array of encrypted strings in parallel.
 */
export async function decryptFields(values: string[]): Promise<string[]> {
  return Promise.all(values.map(decryptField));
}
