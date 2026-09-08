# Optional product photos and nonnegative stock

Implemented locally on September 8, 2026, following the existing forest-green and ivory design system.

## Staff experience

- Add Product accepts an optional JPG, PNG, or WebP image up to 5 MB. The browser validates its type, size, and decodability, then shows a preview. Leaving it empty still saves the product.
- Inventory shows the saved photo beside the product name. A package icon is the fallback when no photo is present or an image cannot load.
- Edit Product can add, replace, or remove a photo. Selecting a file does not upload it until the product is submitted; cancelling the edit does not upload anything.
- Negative Initial Stock or Total Stock input immediately becomes `0`. Whole-number validation also runs before the database write.
- Available stock is never displayed below `0` in Inventory, Dashboard, Sales, or Reservations. Invalid legacy quantities and over-reserved records are not treated as sellable stock. Inventory and Dashboard mark those records for review.
- Editing stock below the current reserved quantity is blocked with an explanation. The save checks the latest stock/reserved quantities and detects intervening changes before applying the update.

## Why the old display could say -1

The previous interface directly displayed `stock - reserved_stock`. A recorded stock value of `-1`, or total stock of `0` with `1` reserved unit, therefore rendered as `-1 left`. The numeric fields had `min="0"`, which validates form submission but does not automatically rewrite typed input.

The browser regression reproduced both the negative dashboard display and an entered `-3` remaining in the stock field before the fix. The same check now passes with `0`. This is a confirmed local reproduction of the reported behavior, not an identification of which live product record caused the user's screenshot. No existing live quantities were rewritten.

## Required Supabase setup

Run `inventory_photo_upgrade.sql` in the existing project's Supabase SQL Editor before releasing photo uploads. It is additive and can be rerun. For a new database, run `schema.sql` first, then this upgrade.

The upgrade:

1. Adds nullable `products.photo_path`.
2. Creates the private `product-photos` bucket with JPG/PNG/WebP and 5 MB restrictions.
3. Allows authenticated staff to read photos and Admins/Managers to upload/delete them, matching Inventory access.
4. Adds nonnegative stock and reserved-stock checks for new writes. `NOT VALID` leaves existing invalid records intact for deliberate review. The UI normalizes negative input before saving; the database rejects invalid writes that bypass it.
5. Returns a read-only list of existing negative or over-reserved records for review.

The client stores object paths rather than temporary preview links. Private photos are displayed through signed URLs valid for one hour, refreshed while Inventory remains open. This follows Supabase's [private bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [bucket upload restrictions](https://supabase.com/docs/guides/storage/buckets/creating-buckets).

Without the upgrade, ordinary products without photos remain compatible. Attempts to upload before setup produce a clear error and retain the form. A failed photo read keeps the inventory table and metrics usable.

## Save and cleanup behavior

- A new file uploads before the product write. A confirmed rejected write removes that unused upload.
- A network failure may leave the database outcome unknown. In that case the photo is kept for recovery, and staff are told to refresh before retrying.
- A replacement/removal deletes the old file only after its product update succeeds. Cleanup failure is reported separately from a successful product save.
- Deleting a product attempts to remove its photo only after the row deletion is confirmed.
- Concurrent photo changes are detected when opening the save; an additional conditional write checks the previous photo path when replacing/removing it.

## Verification

| Check | Result |
| --- | --- |
| TypeScript/Vite production build and Oxlint | Passed. |
| Stock and photo workflow tests | 10 passed, including normalization, over-reserved stock, optionality, file limits, upload failure, cleanup, and unknown save outcomes. |
| Feature browser checks | 15 passed; photo add/reopen/replace/remove at 1440, 390, and 320 px; no-photo save; negative add/edit; guarded reserved stock; upload/save/setup/read errors. |
| Existing screen audit | 40 scenarios passed, zero reported overflow, unlabeled-control, or JavaScript page errors. |
| Existing interaction suite | 17 passed, including grouped receipt, print, Excel, carts, focus, and role UI behavior. |
| Revenue-date regression suite | 3 passed. |
| Migration in embedded PostgreSQL | 5 checks passed using PGlite 0.5.8, including reapplication, nullable photos, bucket restrictions, preserved legacy rows, stock checks, and storage RLS behavior. Supabase auth/storage schemas were minimal test stubs. |
| Mechanical design detector | One pass, no findings. This is not a full accessibility audit. |
| Independent visual review | `ship` for this bounded addition, with no material fixes. It covered all 14 feature captures and the changed photo/stock source. |

Run `npm run test:inventory`, `npm run test:inventory-ui`, or the existing QA commands from `frontend`. Browser tests require the local fixture server, Chrome, and Playwright as documented in `frontend/qa/README.md`. Test images reuse existing project assets and are visibly labeled synthetic in the preview.

For migration testing, install `@electric-sql/pglite@0.5.8` in a disposable local directory and set `PGLITE_MODULE` to its absolute package path, then run `node qa/inventory-migration.cjs` from `frontend`. This test reads the actual upgrade SQL and does not connect to Supabase. Local reports and screenshots are in the ignored `.impeccable/review` directory.

## Current deployment boundary

No Supabase admin connection or local environment credentials were available, and the accessible live application was at its sign-in screen. The upgrade has not been applied to the live project. Source delivery is recorded in Git history; deployment and live database setup are separate steps. Live upload persistence, storage service enforcement, and real product mutations still require validation after setup. The checks above establish local code behavior and SQL behavior in a test database; they do not prove production state.
