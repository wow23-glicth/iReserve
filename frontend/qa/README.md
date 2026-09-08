# Local UI verification

The fixture preview renders the real React screens against in-memory synthetic records. It has no production database connection and is not a login bypass in the normal application. Only qa/vite.config.ts replaces the Supabase module. The production Vite configuration does not load this plugin.

Run `npm run qa:preview` from frontend, then open http://127.0.0.1:4173. The preview starts as Admin and carries a visible synthetic-records badge.

Scenarios:
- `/?state=login`: login screen. Synthetic credentials: username admin, password preview-pass.
- `/?state=empty`: empty operational records.
- `/?state=error`: database error states.
- `/?role=Cashier` or `/?role=Manager`: role-specific UI.

Run `npm run test:metrics` with Node 22.18 or newer for calendar-window regression tests.

For browser verification, install Playwright in your development environment or set PLAYWRIGHT_MODULE to the absolute location of the bundled Playwright package. Chrome must be installed. Start the fixture preview, then run `npm run test:ui`. Screenshots and geometry reports go to ../.impeccable/review.

For the interaction suite, also start the normal application on port 4174 with `npm run dev -- --host 127.0.0.1 --port 4174`. The configuration-error check expects a checkout without Supabase environment credentials. Run `node qa/interactions.cjs` to verify keyboard navigation, pagination, exports, roles, and receipt print layout. Browser checks use fixtures; they do not prove live database writes or production deployment.

The normal application needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env. Without them it renders a clear configuration message and disables sign-in. No real credentials are included in the fixture files.

Inventory checks: `npm run test:inventory` tests stock normalization and photo save/cleanup behavior; `npm run test:inventory-ui` exercises photo workflows and negative stock in Chrome. Additional fixture states are `photos`, `stock-mismatch`, `photo-upload-error`, `photo-save-error`, `photo-missing-column`, and `photo-load-error`. Photo files in these tests stay in the local fixture; nothing is uploaded to Supabase.

`node qa/inventory-migration.cjs` executes the actual upgrade in embedded PostgreSQL. Install `@electric-sql/pglite@0.5.8` outside production dependencies and set PGLITE_MODULE to its package path. The test uses minimal Supabase auth/storage schema stubs and is not live Supabase validation.
