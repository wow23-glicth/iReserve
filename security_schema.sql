-- Security Hardening Schema
-- Run this in the Supabase SQL Editor after applying schema.sql
-- Adds an audit log table, rate-limiting scaffold, and tightens existing policies.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AUDIT LOG TABLE
--    Records every INSERT, UPDATE, and DELETE on core tables.
--    Only the database trigger writes to this table — no client can insert
--    or delete audit rows (enforced by RLS).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.audit_log (
  log_id        bigint generated always as identity primary key,
  table_name    text not null,
  operation     text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id     text,
  changed_by    uuid references auth.users(id) on delete set null,
  changed_at    timestamp with time zone default timezone('utc', now()) not null,
  old_data      jsonb,
  new_data      jsonb
);

-- Enable RLS — authenticated users can read audit logs but CANNOT write to them
alter table public.audit_log enable row level security;

create policy "Authenticated users can read audit logs"
  on public.audit_log for select
  using (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policy for client — only the trigger function can write

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GENERIC AUDIT TRIGGER FUNCTION
--    Attaches to any table. Captures the auth.uid() of the caller.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.record_audit()
returns trigger as $$
declare
  rec_id text;
begin
  -- Derive the primary key value based on operation
  if TG_OP = 'DELETE' then
    rec_id := (row_to_json(OLD) ->> (TG_ARGV[0]));
  else
    rec_id := (row_to_json(NEW) ->> (TG_ARGV[0]));
  end if;

  insert into public.audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
  values (
    TG_TABLE_NAME,
    TG_OP,
    rec_id,
    auth.uid(),
    case when TG_OP = 'INSERT' then null else row_to_json(OLD)::jsonb end,
    case when TG_OP = 'DELETE' then null else row_to_json(NEW)::jsonb end
  );

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ATTACH AUDIT TRIGGERS TO CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- Products audit
drop trigger if exists audit_products on public.products;
create trigger audit_products
  after insert or update or delete on public.products
  for each row execute procedure public.record_audit('product_id');

-- Sales audit
drop trigger if exists audit_sales on public.sales;
create trigger audit_sales
  after insert or update or delete on public.sales
  for each row execute procedure public.record_audit('sale_id');

-- Reservations audit
drop trigger if exists audit_reservations on public.reservations;
create trigger audit_reservations
  after insert or update or delete on public.reservations
  for each row execute procedure public.record_audit('reservation_id');

-- Customers audit
drop trigger if exists audit_customers on public.customers;
create trigger audit_customers
  after insert or update or delete on public.customers
  for each row execute procedure public.record_audit('customer_id');

-- Profiles audit
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after update or delete on public.profiles
  for each row execute procedure public.record_audit('id');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TIGHTEN PRODUCT AND SALES RLS POLICIES
--    Restrict DELETE on products to Admin role only.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the permissive all-staff policy on products
drop policy if exists "Allow all staff to manage products" on public.products;

-- Re-add scoped policies
create policy "Staff can read and insert products"
  on public.products for select
  using (auth.role() = 'authenticated');

create policy "Staff can insert products"
  on public.products for insert
  with check (auth.role() = 'authenticated');

create policy "Staff can update products"
  on public.products for update
  using (auth.role() = 'authenticated');

-- Only admins can delete products
create policy "Only admins can delete products"
  on public.products for delete
  using (
    (select role from public.profiles where id = auth.uid()) = 'Admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PREVENT DELETION OF SALES RECORDS (immutable ledger)
--    Sales are financial records and must never be deleted.
--    Only Admins can delete (for error correction) as a safeguard.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Allow access to sales for all staff" on public.sales;

create policy "Staff can read and insert sales"
  on public.sales for select
  using (auth.role() = 'authenticated');

create policy "Staff can insert sales"
  on public.sales for insert
  with check (auth.role() = 'authenticated');

create policy "Only admins can delete sales"
  on public.sales for delete
  using (
    (select role from public.profiles where id = auth.uid()) = 'Admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ENABLE REALTIME ON AUDIT LOG (optional, for live monitoring)
-- ─────────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.audit_log;
