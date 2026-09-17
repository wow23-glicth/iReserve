-- Upgrade an existing iReserve database so one reservation booking with multiple items
-- is stored and grouped under a transaction_id (matching sales transactions).
-- Run this once in the Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

alter table public.reservations
  add column if not exists transaction_id uuid;

-- Assign a unique UUID for existing historical rows so each remains distinct
update public.reservations
set transaction_id = gen_random_uuid()
where transaction_id is null;

create index if not exists reservations_transaction_id_idx
  on public.reservations (transaction_id);

commit;
