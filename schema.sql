-- iReserve Supabase Database Schema
-- Paste this script into your Supabase SQL Editor and run it to set up tables and triggers.

create extension if not exists pgcrypto;

-- 1. Create Profiles Table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  username text unique not null,
  role text not null check (role in ('Admin', 'Manager', 'Cashier')) default 'Cashier',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- RLS Policies for Profiles
create policy "Allow public read access to profiles" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Allow users to update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Allow admins to manage all profiles" on public.profiles
  for all using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'Admin'
  );

-- 2. Create Products Table
create table public.products (
  product_id bigint generated always as identity primary key,
  product_name text not null,
  unit text not null,
  price numeric(10, 2) not null default 0.00,
  stock integer not null default 0,
  reserved_stock integer not null default 0,
  photo_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Products
alter table public.products enable row level security;

-- RLS Policies for Products
create policy "Allow all staff to manage products" on public.products
  for all using (auth.role() = 'authenticated');


-- 3. Create Customers Table
create table public.customers (
  customer_id bigint generated always as identity primary key,
  name text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Customers
alter table public.customers enable row level security;

-- RLS Policies for Customers
create policy "Allow access to customers for all staff" on public.customers
  for all using (auth.role() = 'authenticated');

-- 4. Create Sales Table
create table public.sales (
  sale_id bigint generated always as identity primary key,
  transaction_id uuid not null default gen_random_uuid(),
  product_id bigint references public.products(product_id) on delete cascade not null,
  customer_id bigint references public.customers(customer_id) on delete cascade not null,
  quantity integer not null check (quantity > 0),
  sale_date date not null default current_date,
  total_amount numeric(12, 2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Sales
alter table public.sales enable row level security;

-- RLS Policies for Sales
create policy "Allow access to sales for all staff" on public.sales
  for all using (auth.role() = 'authenticated');

create index sales_transaction_id_idx on public.sales (transaction_id);

-- Record all line items and deduct stock as one atomic checkout. Any validation
-- failure rolls the entire sale back, so partial receipts cannot be created.
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
    raise exception using errcode = '42501', message = 'Authentication is required to record a sale.';
  end if;

  if p_customer_id is null or not exists (
    select 1 from public.customers where customer_id = p_customer_id
  ) then
    raise exception using errcode = '23503', message = 'The selected customer does not exist.';
  end if;

  if p_transaction_id is null then
    raise exception using errcode = '22023', message = 'A transaction ID is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_transaction_id::text, 0));

  if exists (select 1 from public.sales where transaction_id = p_transaction_id) then
    raise exception using errcode = '23505', message = 'This sales transaction has already been recorded.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'At least one sales item is required.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id bigint, quantity integer)
    where item.product_id is null or item.quantity is null or item.quantity <= 0
  ) then
    raise exception using errcode = '22023', message = 'Every sales item needs a valid product and a quantity greater than zero.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id bigint, quantity integer)
    group by item.product_id
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A product can only appear once in a sales transaction.';
  end if;

  for v_item in
    select item.product_id, item.quantity
    from jsonb_to_recordset(p_items) as item(product_id bigint, quantity integer)
    order by item.product_id
  loop
    select product.* into v_product
    from public.products as product
    where product.product_id = v_item.product_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = format('Product %s was not found.', v_item.product_id);
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

    insert into public.sales (transaction_id, product_id, customer_id, quantity, sale_date, total_amount)
    values (p_transaction_id, v_product.product_id, p_customer_id, v_item.quantity, current_date, v_product.price * v_item.quantity);

    update public.products
    set stock = stock - v_item.quantity
    where product_id = v_product.product_id;
  end loop;

  return query
    select sale.* from public.sales as sale
    where sale.transaction_id = p_transaction_id
    order by sale.sale_id;
end;
$$;

revoke all on function public.record_sale_transaction(bigint, uuid, jsonb) from public;
grant execute on function public.record_sale_transaction(bigint, uuid, jsonb) to authenticated;

-- 5. Create Reservations Table
create table public.reservations (
  reservation_id bigint generated always as identity primary key,
  product_id bigint references public.products(product_id) on delete cascade not null,
  customer_id bigint references public.customers(customer_id) on delete cascade not null,
  quantity integer not null check (quantity > 0),
  reservation_date date not null default current_date,
  status text not null check (status in ('Pending', 'Approved', 'Claimed', 'Cancelled')) default 'Pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Reservations
alter table public.reservations enable row level security;

-- RLS Policies for Reservations
create policy "Allow access to reservations for all staff" on public.reservations
  for all using (auth.role() = 'authenticated');

-- 6. Trigger for Automatic Profile Creation on Supabase Auth Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Staff Member'),
    coalesce(new.raw_user_meta_data->>'username', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'Cashier')
  );
  return new;
end;
$$ language plpgsql security definer;

-- After initial setup, also run inventory_photo_upgrade.sql to create private
-- product-photo storage and enforce nonnegative inventory writes.

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Enable Supabase Realtime on all core tables
-- Run this to allow the frontend to receive live change events
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.customers;

-- 8. RPC Function to allow Admins/Owners to change passwords securely

create or replace function public.update_user_password(user_uuid uuid, new_password text)
returns void as $$
declare
  caller_role text;
begin
  -- Get the role of the caller
  select role into caller_role from public.profiles where id = auth.uid();
  
  -- Allow if caller is Admin or updating their own password
  if caller_role = 'Admin' or auth.uid() = user_uuid then
    update auth.users
    set encrypted_password = crypt(new_password, gen_salt('bf'))
    where id = user_uuid;
  else
    raise exception 'Unauthorized: Only admins or account owners can change passwords.';
  end if;
end;
$$ language plpgsql security definer;

-- 9. RPC Function to allow Admins/Owners to change emails/usernames in auth.users securely
create or replace function public.update_user_email(user_uuid uuid, new_username text)
returns void as $$
declare
  caller_role text;
  new_email text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  
  if caller_role = 'Admin' or auth.uid() = user_uuid then
    if position('@' in new_username) > 0 then
      new_email := new_username;
    else
      new_email := new_username || '@ireserve.local';
    end if;

    update auth.users
    set email = new_email,
        email_confirmed_at = now(),
        raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{username}', to_jsonb(new_username))
    where id = user_uuid;
  else
    raise exception 'Unauthorized: Only admins or account owners can update usernames.';
  end if;
end;
$$ language plpgsql security definer;
