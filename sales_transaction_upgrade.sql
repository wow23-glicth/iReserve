-- Upgrade an existing iReserve database so one checkout is stored as one
-- transaction with several immutable sales line items.
-- Run this file once in the Supabase SQL Editor before deploying the matching UI.

begin;

create extension if not exists pgcrypto;

alter table public.sales
  add column if not exists transaction_id uuid;

-- Historical rows were created independently, so each becomes its own legacy
-- transaction. New multi-item checkouts share one transaction_id.
update public.sales
set transaction_id = gen_random_uuid()
where transaction_id is null;

alter table public.sales
  alter column transaction_id set default gen_random_uuid(),
  alter column transaction_id set not null;

create index if not exists sales_transaction_id_idx
  on public.sales (transaction_id);

create or replace function public.record_sale_transaction(
  p_customer_id bigint,
  p_transaction_id uuid,
  p_items jsonb
)
returns setof public.sales
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item record;
  v_product public.products%rowtype;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to record a sale.';
  end if;

  if p_customer_id is null or not exists (
    select 1 from public.customers where customer_id = p_customer_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'The selected customer does not exist.';
  end if;

  if p_transaction_id is null then
    raise exception using
      errcode = '22023',
      message = 'A transaction ID is required.';
  end if;

  -- Serialize retries carrying the same client-generated ID. This makes the
  -- existence check below an idempotency guard without preventing many
  -- unrelated checkouts from running concurrently.
  perform pg_advisory_xact_lock(hashtextextended(p_transaction_id::text, 0));

  if exists (
    select 1 from public.sales where transaction_id = p_transaction_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This sales transaction has already been recorded.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one sales item is required.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id bigint, quantity integer)
    where item.product_id is null or item.quantity is null or item.quantity <= 0
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every sales item needs a valid product and a quantity greater than zero.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id bigint, quantity integer)
    group by item.product_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'A product can only appear once in a sales transaction.';
  end if;

  -- Lock in product-id order to make concurrent checkouts deterministic and to
  -- ensure stock validation, line insertion, and stock deduction commit together.
  for v_item in
    select item.product_id, item.quantity
    from jsonb_to_recordset(p_items) as item(product_id bigint, quantity integer)
    order by item.product_id
  loop
    select product.*
    into v_product
    from public.products as product
    where product.product_id = v_item.product_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = format('Product %s was not found.', v_item.product_id);
    end if;

    if (v_product.stock - v_product.reserved_stock) < v_item.quantity then
      raise exception using
        errcode = '23514',
        message = format(
          'Insufficient stock for "%s". Only %s %s available.',
          v_product.product_name,
          greatest(v_product.stock - v_product.reserved_stock, 0),
          v_product.unit
        );
    end if;

    insert into public.sales (
      transaction_id,
      product_id,
      customer_id,
      quantity,
      sale_date,
      total_amount
    ) values (
      p_transaction_id,
      v_product.product_id,
      p_customer_id,
      v_item.quantity,
      current_date,
      v_product.price * v_item.quantity
    );

    update public.products
    set stock = stock - v_item.quantity
    where product_id = v_product.product_id;
  end loop;

  return query
    select sale.*
    from public.sales as sale
    where sale.transaction_id = p_transaction_id
    order by sale.sale_id;
end;
$$;

revoke all on function public.record_sale_transaction(bigint, uuid, jsonb) from public;
grant execute on function public.record_sale_transaction(bigint, uuid, jsonb) to authenticated;

comment on function public.record_sale_transaction(bigint, uuid, jsonb) is
  'Atomically records every line in one sale and deducts available stock.';

commit;
