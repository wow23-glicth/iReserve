# PJP Hardware interface redesign

Implemented locally on September 8, 2026. The supplied visual reference guided the forest-green navigation, warm ivory workspace, mint highlights, hardware imagery, and clean operational tables. The user selected balanced attention across all screens.

## Implemented experience

| Surface | Result |
| --- | --- |
| Login | Split brand and sign-in composition, generated hardware still life, labeled fields, password visibility, clear authentication and configuration feedback. |
| Dashboard | Actual record totals, grouped transaction count, seven-day revenue chart, low-stock actions, and distinct empty-inventory guidance. |
| Inventory | Records appear before an expandable product form. Search, stock filters, sorting, ten-row pagination, status badges, edit dialogs, and Excel export remain available. |
| Sales | Expandable checkout with keyboard-searchable products, available-stock feedback, multi-item cart, grouped transaction history, pagination, and printable receipts. |
| Reservations | Matching product selection and cart interaction, status filtering, readable mobile records, pagination, and existing role-dependent actions. |
| Analytics | Revenue and units derived from records, an accurate calendar window for the last seven days, product share chart, and loading, empty, and error states. |
| User Settings | Team summary, records, expandable staff form, consistent dialogs, and existing administrator restrictions. |

Shared components now define statistics, action panels, pagination, product selection, revenue charts, and modal behavior. Mobile records use labeled fields, while desktop screens use tables. The sidebar becomes a dismissible drawer with keyboard focus management. Modals trap and restore focus, support Escape, and prevent background scrolling. Reduced-motion settings are respected.

The existing sale transaction, receipt, reservation, and staff-management contracts were retained. The receipt stylesheet is isolated in `frontend/src/receipt.css`. No database migration or backend deployment was performed for this redesign.

## Visual system and assets

`DESIGN.md` captures the implemented design system. `.impeccable/design.json` contains matching component previews and design metadata. `PRODUCT.md` records product context; the implementation direction also remains in the HTML contract in `frontend/index.html`.

Manrope is served locally from `frontend/public/fonts/manrope-variable.ttf`, with its OFL license alongside it. The new decorative illustration is `frontend/public/hardware-workspace.png`; the complete generation prompt is in `frontend/public/hardware-workspace.png.json`. Existing logo, favicon, and background files were retained, with sidecars explicitly identifying their source as preexisting project assets whose original creator/license was not recorded. The provenance scan found four raster assets and no missing sidecars.

Authenticated screens are loaded on demand. The fixed startup delay was removed. The final production build produced no large-chunk warnings. The normal application shows a clear configuration message when its Supabase environment variables are missing.

## Iteration and verification

The implementation was rendered in Chrome, inspected, corrected, and recaptured. An independent finish review identified two material visual corrections: an empty inventory must not be described as healthy stock, and several small-text colors needed more contrast. Both were corrected. The follow-up reviewer marked both resolved and returned `disposition: ship` for those scored corrections; that verdict is not a blanket certification of the entire product.

The corrected small-text color has measured contrast from 4.948:1 to 5.544:1 on the five flagged backgrounds. A later keyboard check also corrected ArrowUp selection from an unselected product picker; both Sales and Reservations now select the last available option and wrap correctly in either direction.

| Verification | Observed result |
| --- | --- |
| TypeScript and Vite production build | Passed. |
| Oxlint | Passed. |
| Revenue-window regression tests | Three passed: year boundary and zero days, exclusion of old-year/future records, empty week. |
| Browser screen audit | Forty scenarios; zero reported overflow, structural-layout, unlabeled-control, or JavaScript page errors. |
| Responsive coverage | Six authenticated screens at 320, 390, 768, 1280, and 1440 px; Login at 320, 390, and 1440 px; additional forms, dialogs, filters, empty, and error states. |
| Interaction suite | Seventeen passed, including mobile navigation, focus management, keyboard picker wrapping, carts, pagination, filters, cancelable delete confirmation, Excel export, grouped receipt, print isolation, role-specific UI, and missing-config feedback. |
| Independent visual review | Both requested corrections resolved; twenty final captures inspected or available as evidence. |
| Mechanical design detector | One pass with no findings. This is not a full accessibility audit. |
| Production-fixture separation | Fixture module, synthetic login, and preview banner absent from the built production assets. |
| Whitespace validation | `git diff --check` passed. |

Local evidence is in `.impeccable/review/` (ignored by Git): `audit-final.json`, `interactions.json`, the final desktop/mobile screenshots, `inventory-export.xlsx`, and `receipt-print.pdf`. A preexisting browser notice that the meta-tag CSP cannot enforce `frame-ancestors` remains outside this visual redesign.

## Preview and repeat the checks

From `frontend`, run:

```powershell
npm.cmd run qa:preview
```

Open http://127.0.0.1:4173. The preview uses the real components with in-memory synthetic records and displays a visible preview badge. Only `qa/vite.config.ts` aliases the database module. This preview has no production database connection and does not add a login bypass to the normal application.

Useful scenarios are `/?state=login`, `/?state=empty`, `/?state=error`, `/?role=Cashier`, and `/?role=Manager`. The synthetic sign-in is `admin` / `preview-pass`.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:metrics
npm.cmd run test:ui
```

The browser checks need installed Chrome and a resolvable Playwright module. Set `PLAYWRIGHT_MODULE` when using a bundled runtime. For `node qa/interactions.cjs`, also start the normal application on port 4174 without Supabase configuration, as described in `frontend/qa/README.md`.

## Verification boundary

The UI is implemented and locally verified. This checkout had no configured Supabase credentials, so authentication and database responses in browser QA were synthetic. The checks establish local presentation, interactions, exports, and receipt behavior. They do not establish live database mutations, server-side access enforcement, production deployment, or full assistive-technology compatibility. No live transactions were created during UI verification. Source delivery is recorded in Git history; deployment and live database validation remain separate steps.
