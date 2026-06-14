# ShipNavi Testing and Review Checklist

This document defines the canonical checks for ShipNavi governance and fare-related reviews.

## Minimum commands

Run these before finalizing any fare-related or governance-only change:

```bash
node --check assets/dashboard.js
git diff --check
```

For documentation-only changes, `git diff --check` verifies whitespace and patch hygiene, while `node --check assets/dashboard.js` confirms the runnable dashboard file was not accidentally broken.

## Runtime inspection requirement

Do not approve fare-related work by checking only commits or PR metadata. Inspect actual code and confirm the relevant functions participate in the running flow.

## PR15 advanced CSV and fare matrix import engine

Confirm all of the following still exist and are connected:

- Marketplace order CSV mappings cover ShipNavi standard, 楽天, Amazon, Yahoo ショッピング, Shopify, BASE, MakeShop, and カラーミー.
- `detectOrderCsvFormat` identifies the platform from actual headers.
- `importOrderCsvRows` returns platform, orders, success count, failure count, warning count, warning details, missing headers, and detected headers.
- The order CSV submit handler uses the platform detection/import result and writes orders data.
- `detectFareTableFormat` distinguishes vertical fare tables from matrix fare tables.
- `normalizeFareMatrix` converts matrix rows into fare rows used by calculation.
- The fare-table CSV submit handler branches through vertical or matrix import paths.

## PR16 matrixView + normalizedFareRows + matrix editing

Confirm all of the following still exist and are connected:

- `normalizeFareTableState` supports legacy arrays, `matrixView`, and `normalizedFareRows`.
- `getFareRows` reads calculation data from `normalizedFareRows`.
- The carriers table can render the matrix editor.
- Matrix save reads editor inputs, builds the next matrix, and calls `normalizeFareMatrix`.
- Matrix save updates both `fareTables` and legacy carriers data where required by the current dashboard flow.

## PR17 smart product master import

Confirm all of the following still exist and are connected:

- `isExcelFile` detects `.xlsx` and `.xls`.
- `productFieldCandidates` covers SKU, product name, size, weight, length, width, height, and bundleable candidates.
- `importProductCsvRows` performs product CSV normalization.
- Missing SKU with a product name falls back to product name as SKU and emits a warning.
- Missing weight emits `重量未設定`.
- The product import submit handler calls `importProductCsvRows`.
- Product import summary includes product count, success count, failure count, warning count, and warning details.

## PR18 dashboard import integration

Confirm these dashboard chains remain connected:

- Product import: file input → file guard → `parseCsv` → `importProductCsvRows` → `setData('products')` → `renderProducts` → summary/toast.
- Fare import: file input → `parseCsv` → `detectFareTableFormat` → `normalizeFare` or `normalizeFareMatrix` → `setFareTableState` → `renderCarriers`.
- Order import: file input → `parseCsv` → `detectOrderCsvFormat` or `importOrderCsvRows` → `setData('orders')` → `renderOrders` → summary/toast.
- Results center: orders/products/fares → shipment groups → recommendation rows → CSV export.

## P0 checks

### P0-1 postal zone detection

Confirm:

- Valid seven-digit postal codes identify the zone by the first three digits.
- Valid seven-digit postal codes outside the mapping return `unknown`.
- Address fallback is used only when a valid postal-code match cannot be used.

### P0-2 fare option filtering

Confirm:

- No fare rows or no requested size returns an empty list.
- Zone `unknown` returns an empty list.
- Only supported carriers and positive fares remain.
- Only matching zone or `default` rows remain.
- Fare size must be greater than or equal to requested size and must be in supported shipping sizes.
- `weightLimit` equal to zero or blank is treated as unlimited; otherwise actual weight must fit.
- Sorting is by size first and fare second.

### P0-3 bundle eligibility

Confirm:

- Orders with missing product master records are not bundleable.
- Products with `bundleable: false` are not bundleable.
- Bundle candidates require every order in the group to be bundleable.


## Phase6 acceptance additions

### Cross-page persistent issue checks

- Dashboard, Products, Orders, Carriers, and Results show unresolved issue counts when open import issues exist.
- Issue details can be opened from the top page indicator.
- Issue details can navigate to the source page.
- Issues remain visible until `resolved` or `dismissed`.
- Toast-only warnings are not sufficient.
- Silent failures are not allowed.

### Generated template checks

- CSV and Excel templates are generated from current field definitions.
- Template downloads cover 商品マスタ, 送料マトリクス, 配送会社, 注文データ, 楽天, Yahoo, Amazon, Shopify, BASE, STORES, and メルカリShops.
- Templates include required columns, optional columns, sample rows, notes, Excel instruction sheet, and Excel data entry sheet.
- Downloaded CSV and Excel templates can be uploaded back into the importer for validation.
- iPhone Safari can download templates through a user tap.

### Product size estimation checks

- Length / width / height aliases and 三辺合計 are detected.
- mm units are converted to cm.
- Unknown units create `unit_mismatch` issues.
- Missing dimensions create issues.
- Size mismatch creates warning issues.
- Over 160 creates oversized issues.
- Calculated size is stored on the product row.

### Fixture coverage checks

`test-fixtures/` must include real-format anonymized samples for 楽天, Yahoo, Amazon, Shopify, BASE, STORES, メルカリShops, 商品マスタ, 送料マトリクス, 配送会社, and 注文データ. Each class must cover normal data, missing SKU, missing weight, invalid postal code, invalid region, mismatched column name, unit error, header not on first row, blank rows, extra explanatory rows, ¥ / 円 / comma amounts, mixed g / kg weights, and mixed cm / mm sizes.

### Phase7 order import checks

- Platform order fixtures must validate missing recipient / customer values as persistent `missing_recipient` issues.
- Missing recipient rows must show Japanese guidance (`顧客名が見つかりません。`) and must not fail silently.
- Platform order fixtures must validate import preview metadata for detected platform, row count, mapped fields, missing fields, and warning count.
- Existing missing SKU fallback, postal-code, malformed quantity, platform detection, and `sourcePlatform` checks must remain passing.

### Phase6 per-step commands

After every Phase6 module, run:

```bash
node --check assets/dashboard.js
git diff --check
```

If fixture validation exists, run:

```bash
node scripts/validate-import-fixtures.js
```
