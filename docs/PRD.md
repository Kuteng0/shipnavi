# ShipNavi PRD

## 1. Product summary

ShipNavi is a Japan-focused shipping-cost management platform for EC operators. It helps operations teams import marketplace orders, maintain product master data, manage carrier fare tables, identify destination zones, evaluate bundle candidates, and compare shipping options from a Japanese-language dashboard.

The current product is a local-first dashboard prototype backed by browser LocalStorage. The product direction is to evolve it into a production-grade SaaS for Japanese merchants that need reliable shipping-cost governance across marketplaces and carriers.

## 2. Target users

- Japanese EC operators selling through 楽天, Yahoo ショッピング, Amazon, Shopify, BASE, and future platforms.
- Store operations staff responsible for CSV order import, product master maintenance, shipping method selection, and shipment preparation.
- Logistics managers who need fare-table governance, carrier comparison, and bundle-rule visibility.
- Small teams that need a Japanese back-office UI usable on desktop and mobile without complex warehouse software.

## 3. Current product capabilities

### 3.1 商品管理

Product management stores SKU-based product master records used by shipment grouping and fare estimation. Current product data includes SKU, product name, size, weight, dimensions, and bundle eligibility.

Core requirements:

- Create, edit, delete, search, and CSV-import product master records.
- Preserve product dimensions for bundled-size estimation.
- Preserve `bundleable` status so bundle rules can reject ineligible products.
- Warn when imported product data is incomplete, especially when SKU or weight is missing.

### 3.2 配送会社管理

Carrier management stores fare rows that represent carrier, service, size, zone, weight limit, and fare. The dashboard currently focuses on supported Japanese carriers and local fare-table management.

Core requirements:

- Manage carrier/service fare rows.
- Import fare tables from CSV.
- Keep fare data normalized for recommendation logic.
- Preserve enough metadata to compare multiple carrier/service candidates.

### 3.3 送料マトリクス

The fare matrix feature supports matrix-style fare tables common in Japanese carrier contracts, where rows represent size or weight and columns represent delivery zones.

Core requirements:

- Detect matrix fare CSV format.
- Store matrix data in a UI-friendly `matrixView`.
- Convert matrix data to calculation-friendly `normalizedFareRows`.
- Allow matrix editing from the carrier dashboard.
- Keep `matrixView` and `normalizedFareRows` synchronized after edits.

### 3.4 CSV / Excel 导入

CSV import is the primary supported ingestion path. Excel files are recognized and must receive a user-facing conversion message until native XLS/XLSX parsing is implemented.

Core requirements:

- Parse CSV with normalized headers and BOM handling.
- Reject unsupported image uploads with clear messages.
- Detect `.xls` and `.xlsx` uploads and instruct users to convert to CSV until Phase 6.
- Return import summaries with total count, success count, failure count, warning count, and warning details.
- Preserve missing-field and unsupported-format messages in Japanese dashboard flows.

### 3.5 多平台订单导入

Order import supports multiple marketplace formats through field mappings and platform detection.

Current platform scope:

- ShipNavi standard CSV.
- 楽天.
- Amazon.
- Yahoo ショッピング.
- Shopify.
- BASE.
- MakeShop.
- カラーミー.

Future platform scope:

- STORES.
- メルカリShops.
- Additional Japanese marketplace and cart formats requested by merchants.

Core requirements:

- Detect source platform from actual CSV headers.
- Map platform-specific fields to order number, customer, postal code, address, SKU, product name, and quantity.
- Use product name as SKU fallback only when necessary and show a warning.
- Show unsupported-format messages that include detected headers.

### 3.6 邮编区域

Postal-zone detection maps Japanese postal codes and addresses to fare zones used for carrier comparison.

Core requirements:

- Prefer valid seven-digit postal-code matching.
- Use the first three digits to infer supported zones.
- Return `unknown` for valid seven-digit postal codes outside the supported mapping.
- Use address fallback only when postal-code detection cannot be used.
- Avoid silently assigning a fare zone when the destination cannot be trusted.

### 3.7 同梱规则

Bundle logic groups orders by customer, postal code, and address, then checks every order in the group for product-level bundle eligibility.

Core requirements:

- Do not bundle orders when product master data is missing.
- Do not bundle products marked `bundleable: false`.
- Group only when all orders in the candidate group are eligible.
- Estimate bundled size from item dimensions and largest item size.
- Keep bundle status visible in order and result screens.

### 3.8 日语后台

The dashboard is intended for Japanese operations teams and should keep Japanese labels, messages, and domain terms.

Core requirements:

- Navigation includes Dashboard, 商品管理, 配送会社, 注文取込, CSVテンプレート, 結果センター, and 設定.
- Import errors and summaries should be understandable to Japanese operators.
- Shipping domain terms such as 同梱, 運賃表, 配送会社, 郵便番号, and 注文取込 should remain consistent.

### 3.9 手机端管理

The dashboard includes a responsive app navigation toggle and should remain usable on mobile devices for lightweight operations review.

Core requirements:

- Mobile navigation must remain accessible through the app menu toggle.
- Tables should remain readable through responsive table containers.
- Primary operations such as searching orders, reviewing results, and checking import status should work on small screens.

### 3.10 未来 AI 导入修复助手

Future versions should include an AI-assisted import repair workflow for unsupported or partially mapped files.

Target capabilities:

- Detect unmapped headers and suggest field mappings.
- Explain missing required fields in Japanese.
- Suggest CSV transformations or template downloads.
- Generate a preview before applying repaired mappings.
- Learn reusable mappings per tenant or shop after operator approval.

## 4. Success metrics

- Import success rate by platform and file type.
- Reduction in unsupported CSV formats requiring manual cleanup.
- Percentage of shipments receiving a valid fare recommendation.
- Percentage of bundle candidates accepted or rejected with clear reasons.
- Time from order import to result-center export.
- Operator error rate in fare table and product master maintenance.

## 5. Non-goals for the current prototype

- Direct carrier API purchase, label issuance, or shipment booking.
- Native XLS/XLSX parsing before Phase 6.
- Multi-tenant authentication and billing before Phase 9.
- Automated AI modification of imported data without human preview and approval.
