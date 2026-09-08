-- Run once in the existing project's Supabase SQL Editor before enabling photos.
-- Additive and safe to re-run. Existing stock counts are not rewritten.
begin;

alter table public.products add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Staff can view product photos" on storage.objects;
create policy "Staff can view product photos" on storage.objects
  for select to authenticated using (bucket_id = 'product-photos');

drop policy if exists "Inventory managers can upload product photos" on storage.objects;
create policy "Inventory managers can upload product photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = 'products'
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('Admin','Manager'))
  );

drop policy if exists "Inventory managers can remove product photos" on storage.objects;
create policy "Inventory managers can remove product photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-photos'
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('Admin','Manager'))
  );

-- Inventory inputs normalize negatives to zero before saving. Reject negative
-- API writes here so a failed stock deduction cannot silently become an oversale.
-- NOT VALID preserves legacy records for deliberate review while checking new writes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_stock_nonnegative' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_stock_nonnegative check (stock >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_reserved_nonnegative' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_reserved_nonnegative check (reserved_stock >= 0) not valid;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Read-only review: a negative available quantity means reserved exceeds on-hand.
select product_id, product_name, stock, reserved_stock,
  stock - reserved_stock as recorded_available,
  greatest(0, stock - greatest(0, reserved_stock)) as displayed_available
from public.products
where stock < 0 or reserved_stock < 0 or reserved_stock > stock
order by product_id;
