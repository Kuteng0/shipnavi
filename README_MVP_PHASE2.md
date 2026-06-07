# ShipNavi MVP Phase 2 Plan

This repository snapshot does not expose a remote `main` branch in the local Git environment, so I cannot guarantee a conflict-free code PR based on the latest merged Dashboard Prototype PR #4. Per the instruction, this change does **not** modify Dashboard UI or existing website files. It only records the implementation plan for the next conflict-free branch.

## Scope

Continue from the currently merged Dashboard prototype and add business logic incrementally without rebuilding existing pages.

## Constraints

- Do not modify public website files:
  - `index.html`
  - `style.css`
  - `app.js`
  - legal/contact pages
- Do not rebuild existing Dashboard pages.
- Keep Cloudflare Pages deployable.
- Continue using:
  - HTML
  - CSS
  - JavaScript
  - LocalStorage
- Do not add:
  - Cloudflare D1
  - Stripe
  - Login
  - External API dependencies

## Incremental implementation plan

### Products

Use existing `products.html` UI and only extend `assets/dashboard.js` where needed.

Required behavior:

- Add product
- Edit product
- Delete product
- CSV import
- Persist products to LocalStorage

Data fields:

- SKU
- Product name
- Weight
- Length
- Width
- Height
- Bundle eligibility

### Carriers

Use existing `carriers.html` UI and only extend dashboard logic where needed.

Required behavior:

- Add carrier
- Edit carrier
- Delete carrier
- Import fare table CSV
- Persist carriers and fare table rows to LocalStorage

Fare table fields:

- Region
- Size
- Weight
- Price

### Orders

Use existing `orders.html` UI.

Required behavior:

- CSV upload
- Excel upload mock handling
- Order preview table
- Persist parsed orders to LocalStorage

Order fields:

- Order number
- Recipient
- Postal code
- Address
- SKU
- Quantity

### Templates

Use existing `templates.html` UI.

Required behavior:

- Upload customer CSV template
- Parse template headers
- Display field mapping UI
- Persist templates and mappings to LocalStorage

Suggested standard fields:

- Order number
- Recipient
- Postal code
- Address
- SKU
- Quantity

### Results

Use existing `results.html` UI.

Required behavior:

- Generate mock fare comparison results
- Display recommended carrier
- Display lowest price
- Display savings amount
- Persist generated result snapshots to LocalStorage

### Business logic modules to add or isolate

If the current Dashboard code already has a shared dashboard script, implement these as small pure functions inside `assets/dashboard.js` or in a dashboard-only helper file if already supported by the merged main branch:

- `parseCsvLine(line)`
- `parseCsv(text)`
- `normalizeProduct(record)`
- `normalizeCarrier(record)`
- `normalizeFare(record)`
- `normalizeOrder(record)`
- `findBundleCandidates(orders, products)`
- `compareFares(orders, carriers, fareRows)`
- `recommendCarrier(order, fareRows)`
- `saveResultSnapshot(result)`

## Suggested validation before code PR

Run these checks after creating a new branch from the actual latest `main`:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b shipnavi-mvp-phase2-incremental
node --check assets/dashboard.js
python3 -m http.server 8787
```

Then smoke-check:

- `/dashboard.html`
- `/products.html`
- `/carriers.html`
- `/orders.html`
- `/templates.html`
- `/results.html`
- `/settings.html`

## Notes

This file is intentionally a plan-only fallback. No Dashboard UI or website files are modified in this PR.
