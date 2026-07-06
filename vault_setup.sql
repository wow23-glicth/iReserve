-- ─────────────────────────────────────────────────────────────────────────────
-- vault_setup.sql
-- Run this ONCE in your Supabase SQL Editor.
-- Stores the AES-256-GCM field-encryption key in Supabase Vault (pgsodium)
-- and exposes it through a secure RPC callable only by authenticated users.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure pgsodium / Vault extension is available
--    (enabled by default on most Supabase projects; safe to run again)
create extension if not exists pgsodium;
create extension if not exists supabase_vault;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Insert the key into Vault
--    Replace the value below with your actual Base64 key from .env.local
--    (VITE_FIELD_ENCRYPTION_KEY).  Run this block ONCE; then delete the env var.
-- ─────────────────────────────────────────────────────────────────────────────
select vault.create_secret(
  'WXvkgbUANxncCmwj5nQwZlreAAzoDL9hI0v2R7Q/k/A=',   -- <-- your Base64 key
  'field_encryption_key',                              -- secret name (unique)
  'AES-256-GCM field-level encryption key for customer PII'
);

-- If you ever need to rotate the key, use:
--   select vault.update_secret(<uuid>, 'NEW_BASE64_KEY');
-- where <uuid> comes from:
--   select id from vault.secrets where name = 'field_encryption_key';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC function: get_encryption_key()
--    Returns the Base64 key string to any authenticated caller.
--    Runs as SECURITY DEFINER so only the function — never the client — touches
--    vault.decrypted_secrets directly.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_encryption_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  -- Only authenticated users may retrieve the key
  if auth.role() <> 'authenticated' then
    raise exception 'Unauthorized';
  end if;

  select decrypted_secret
  into v_key
  from vault.decrypted_secrets
  where name = 'field_encryption_key'
  limit 1;

  if v_key is null then
    raise exception 'Encryption key not found in vault. Run vault_setup.sql first.';
  end if;

  return v_key;
end;
$$;

-- 4. Grant execute to authenticated role only (anon cannot call this)
revoke execute on function public.get_encryption_key() from public, anon;
grant  execute on function public.get_encryption_key() to authenticated;
