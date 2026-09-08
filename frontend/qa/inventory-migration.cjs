// Executes the actual migration in embedded PostgreSQL with minimal Supabase schema stubs.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const db = new PGlite(); const checks = [];
  try {
    await db.exec(`
      create role authenticated;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
      create table public.profiles(id uuid primary key,role text);
      create table public.products(product_id serial primary key,product_name text,stock integer not null,reserved_stock integer not null);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id serial primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to authenticated;
      grant select on public.profiles to authenticated;
      grant select,insert,delete on storage.objects to authenticated;
      grant usage on all sequences in schema storage to authenticated;
      insert into public.products(product_name,stock,reserved_stock) values ('Legacy negative',-1,0),('Over reserved',0,1);
      insert into public.profiles values ('00000000-0000-0000-0000-000000000001','Admin'),('00000000-0000-0000-0000-000000000002','Manager'),('00000000-0000-0000-0000-000000000003','Cashier');
    `);
    const sql = fs.readFileSync(path.resolve('../inventory_photo_upgrade.sql'),'utf8');
    await db.exec(sql); await db.exec(sql);checks.push('Migration executes and is safe to rerun');
    const bucket = (await db.query("select * from storage.buckets where id='product-photos'")).rows[0];
    assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
    checks.push('Photo bucket is private and restricts size and MIME types');
    assert.equal((await db.query("select stock from public.products where product_name='Legacy negative'")).rows[0].stock,-1);
    checks.push('Legacy stock discrepancies are preserved for review');
    await assert.rejects(db.exec("insert into public.products(product_name,stock,reserved_stock) values ('Invalid',-1,0)"),/products_stock_nonnegative/);
    await assert.rejects(db.exec("insert into public.products(product_name,stock,reserved_stock) values ('Invalid',1,-1)"),/products_reserved_nonnegative/);
    await db.exec("insert into public.products(product_name,stock,reserved_stock) values ('No photo',0,0)");
    assert.equal((await db.query("select photo_path from public.products where product_name='No photo'")).rows[0].photo_path,null);
    checks.push('Zero stock and omitted photos work; new negative stock and reserved writes fail');
    for (const [id,role] of [['1','Admin'],['2','Manager'],['3','Cashier']]) {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${id}',false);`);
      if (role==='Cashier') await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('product-photos','products/cashier.png')"),/row-level security/);
      else await db.exec(`insert into storage.objects(bucket_id,name) values ('product-photos','products/${role}.png')`);
      assert.equal((await db.query("select count(*)::int as count from storage.objects where bucket_id='product-photos'")).rows[0].count,role==='Admin'?1:2);
      if(role==='Cashier') {
        await db.exec("delete from storage.objects where bucket_id='product-photos'");
        assert.equal((await db.query("select count(*)::int as count from storage.objects where bucket_id='product-photos'")).rows[0].count,2);
      }
      await db.exec('reset role');
    }
    checks.push('Admins and Managers upload; Cashiers can read but cannot upload or delete');
    console.log(JSON.stringify({passed:checks.length,checks},null,2));
    fs.writeFileSync(path.resolve('../.impeccable/review/inventory-migration.json'),JSON.stringify({checks},null,2));
  } finally { await db.close(); }
})().catch(error => { console.error(error);process.exitCode=1; });
