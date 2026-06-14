# ShipNavi Phase6 test fixtures

These fixtures are anonymized real-format samples for Phase6 real-data import validation. They are not customer data and must not contain real names, phone numbers, email addresses, or detailed real addresses.

## Scope

- Order data: 楽天, Yahoo, Amazon, Shopify, BASE, STORES, メルカリShops.
- Business data: 商品マスタ and 送料マトリクス.
- File planning: each fixture set keeps CSV in the repository and generates the matching XLSX locally so Phase6 can validate both import paths without committing binary files.


## XLSX fixture generation

Codex Review does not support committed binary XLSX fixtures, so `.xlsx` files under `test-fixtures/` are generated locally and are not committed to the repository. Keep the CSV fixtures as the source of truth and run the generator when XLSX fixtures are needed:

```bash
node scripts/generate-xlsx-fixtures.js
```

The generator uses ShipNavi's existing lightweight XLSX workbook generation code from `assets/dashboard.js` and creates XLSX files equivalent to each CSV fixture. `node scripts/validate-import-fixtures.js` will generate the XLSX fixtures automatically if they are missing, or you can run the generator manually before validation.

## Anonymization rules

- Customer names use values such as `テスト購入者` only.
- Addresses use `東京都テスト区サンプル町` style dummy addresses only.
- No phone numbers, emails, or real detailed addresses are included.
- Order IDs and SKUs use `*-TEST-*` or `SKU-*` dummy identifiers.

## Fixture purpose by path

| Path | Purpose |
| --- | --- |
| `orders/rakuten/normal.csv` / generated `.xlsx` | 楽天 normal order import with expected headers and values. |
| `orders/rakuten/edge-cases.csv` / generated `.xlsx` | 楽天 edge cases: missing SKU, missing weight, invalid postal code, invalid region, column mismatch, unit errors, non-first-row header, blank rows, explanatory rows, currency formats, mixed g/kg and cm/mm values. |
| `orders/yahoo/normal.csv` / generated `.xlsx` | Yahoo normal order import with expected headers and values. |
| `orders/yahoo/edge-cases.csv` / generated `.xlsx` | Yahoo edge cases for persistent issue and field recognition validation. |
| `orders/amazon/normal.csv` / generated `.xlsx` | Amazon normal order import with expected English marketplace headers. |
| `orders/amazon/edge-cases.csv` / generated `.xlsx` | Amazon edge cases for SKU candidate, unit, postal, amount, and region issues. |
| `orders/shopify/normal.csv` / generated `.xlsx` | Shopify normal order import with Shipping and Lineitem fields. |
| `orders/shopify/edge-cases.csv` / generated `.xlsx` | Shopify edge cases for Variant SKU candidate, weight/size unit, postal, and region issues. |
| `orders/base/normal.csv` / generated `.xlsx` | BASE normal order import with Japanese order fields. |
| `orders/base/edge-cases.csv` / generated `.xlsx` | BASE edge cases for column mismatch and persistent warnings. |
| `orders/stores/normal.csv` / generated `.xlsx` | STORES planned platform mapping fixture. |
| `orders/stores/edge-cases.csv` / generated `.xlsx` | STORES planned platform edge cases for Phase6/Phase7 mapping validation. |
| `orders/mercari-shops/normal.csv` / generated `.xlsx` | メルカリShops planned platform mapping fixture. |
| `orders/mercari-shops/edge-cases.csv` / generated `.xlsx` | メルカリShops planned platform edge cases for Phase6/Phase7 mapping validation. |
| `products/product-master-normal.csv` / generated `.xlsx` | 商品マスタ normal import with SKU, product name, weight, dimensions, bundle eligibility, and size. |
| `products/product-master-edge-cases.csv` / generated `.xlsx` | 商品マスタ edge cases: missing SKU, missing weight, unit mismatch, mm/cm mixed dimensions, size mismatch, oversized parcel, blank rows, explanatory rows. |
| `fares/fare-matrix-normal.csv` / generated `.xlsx` | 送料マトリクス normal import with size, weight, and zone columns. |
| `fares/fare-matrix-edge-cases.csv` / generated `.xlsx` | 送料マトリクス edge cases: explanatory rows before header, mm size, mixed currency formats, missing zone fare, invalid amount/region cell, oversized size, blank rows. |

## Required Phase6 validation coverage

These fixtures are intended to validate:

- CSV import.
- XLSX import.
- Smart field recognition.
- Persistent issue model.
- Platform detection.
- Fare matrix parsing.
- `matrixView` / `normalizedFareRows` synchronization.
- Japanese error messages.
- iPhone Safari operability for file selection and template download.

## Prohibited use

- Do not add real customer personal information.
- Do not add real names, phone numbers, emails, or detailed addresses.
- Do not replace these with mock schemas unrelated to real marketplace exports.

## Revised Phase8 shipment queue fixture use

The existing anonymized order fixtures remain the CSV source of truth for shipment queue validation. Normal fixtures validate shippable imported orders, while edge-case fixtures validate queue exception behavior such as 保留 and エラー through missing recipient, missing postal, malformed quantity, missing SKU fallback, alternate recipient, alternate SKU, split address, and combined address rows. Generated XLSX fixtures must continue to be produced from these CSV sources and must not be committed.

## Revised Phase8 shipment export fixture use

Shipment export validation uses the existing anonymized order, product, and fare fixture shapes as source data. The validator seeds exportable, 保留, and エラー shipment rows from dummy fixture values, verifies the CSV field contract, and confirms generated XLSX fixtures remain derived from CSV source files only.

## Revised Phase8 shipment results fixture use

Shipment results validation reuses anonymized fixture-shaped orders, products, and fare rows to seed shipped, 保留, and エラー states. The validator checks carrier/status/savings summaries without adding real customer data or changing CSV source-of-truth policy.
