# ShipNavi Import Specification

## 1. Purpose

This specification defines the expected import behavior for ShipNavi order, product master, and fare-table data. It reflects the current dashboard code and the near-term requirements for Japan-focused shipping operations.

## 2. Supported file types

### 2.1 CSV

CSV is the primary supported import format.

Requirements:

- Accept `.csv` and `text/csv` uploads where the page file input allows them.
- Remove UTF-8 BOM before parsing.
- Normalize headers with NFKC normalization, trimming, whitespace normalization, Japanese bracket cleanup, and lowercase comparison.
- Preserve quoted comma and newline content during parsing.
- Show row-level import summaries after processing.

### 2.2 XLS

Current behavior:

- `.xls` files are detected as Excel files.
- Native parsing is not yet implemented.
- The user must be instructed to save or export the file as CSV before upload.

Future requirement:

- Phase 6 should add real XLS parsing or a controlled conversion flow with preview.

### 2.3 XLSX

Current behavior:

- `.xlsx` files are detected as Excel files.
- Native parsing is not yet implemented.
- The user must be instructed to save or export the file as CSV before upload.

Future requirement:

- Phase 6 should add real XLSX parsing or a controlled conversion flow with preview.

## 3. Order import platforms

### 3.1 ShipNavi standard CSV

Canonical fields:

- `orderNo`
- `customer`
- `postal`
- `address`
- `sku`
- `quantity`
- optional `sourcePlatform`

### 3.2 楽天

Supported mapping includes:

- 注文番号 → order number.
- 注文者名字 + 注文者名前 or 送付先氏名 → customer.
- 送付先郵便番号 → postal code.
- 送付先住所:都道府県 + 送付先住所:都市区 + 送付先住所:町以降 or 送付先住所 → address.
- 商品番号 or 商品管理番号 → SKU.
- 商品名 → product-name fallback.
- 個数 → quantity.

### 3.3 Yahoo ショッピング

Supported mapping includes:

- 注文ID → order number.
- お届け先氏名 → customer.
- 郵便番号 → postal code.
- 住所 → address.
- 商品コード → SKU.
- 商品名 → product-name fallback.
- 数量 → quantity.

### 3.4 Amazon

Supported mapping includes:

- `order-id` → order number.
- `buyer-email` or `recipient-name` → customer.
- `ship-postal-code` → postal code.
- `ship-state` + `ship-city` + `ship-address-1` → address.
- `sku` → SKU.
- `product-name` → product-name fallback.
- `quantity-purchased` → quantity.

### 3.5 Shopify

Supported mapping includes:

- `Name` → order number.
- `Shipping Name` → customer.
- `Shipping Zip` → postal code.
- `Shipping Province` + `Shipping City` + `Shipping Address1` → address.
- `Lineitem sku` → SKU.
- `Lineitem name` → product-name fallback.
- `Lineitem quantity` → quantity.

### 3.6 BASE

Supported mapping includes:

- 注文ID → order number.
- 購入者名 → customer.
- 郵便番号 → postal code.
- 住所 → address.
- 商品コード → SKU.
- 商品名 → product-name fallback.
- 数量 → quantity.

### 3.7 STORES

Planned mapping target:

- Order identifier → order number.
- Buyer or recipient name → customer.
- Postal code → postal code.
- Prefecture, city, and street fields → address.
- Item code, SKU, or variation code → SKU.
- Item name → product-name fallback.
- Quantity → quantity.

STORES support should be added through the same platform-detection and field-candidate mechanism used by existing platforms.

### 3.8 メルカリShops

Planned mapping target:

- Order or transaction identifier → order number.
- Recipient name → customer.
- Postal code → postal code.
- Shipping address fields → address.
- SKU, product code, or variation identifier → SKU.
- Product name → product-name fallback.
- Quantity → quantity.

メルカリShops support should include explicit warnings when SKU is unavailable and product name is used as fallback.

## 4. Product master import mapping

Product import should map the following logical fields:

- SKU: `sku`, `SKU`, 商品番号, 商品コード, 商品管理番号, 品番, 商品ID, 型番.
- Product name: `name`, 商品名, 商品名称, `product-name`, `Product Name`, 品名.
- Size: `size`, サイズ, 配送サイズ, 三辺合計, 総長, 梱包サイズ.
- Weight: `weight`, 重量, 重量(g), 重量kg, 商品重量, 梱包重量.
- Length: `length`, 長さ, 縦, 奥行, 梱包長さ.
- Width: `width`, 幅, 横, 梱包幅.
- Height: `height`, 高さ, 厚さ, 梱包高さ.
- Bundleable: `bundleable`, 同梱可, 同梱, 同梱区分.

Requirements:

- SKU or product name must be present to identify a product row.
- If SKU is missing but product name exists, use product name as SKU and emit a warning.
- If weight is missing, emit `重量未設定`.
- Size may be imported directly or estimated from length + width + height.

## 5. Fare table import mapping

### 5.1 Vertical fare table

Required fields:

- `carrier`
- `service`
- `size`
- `zone`
- `fare`

Optional fields:

- `weight` or `weightLimit`.

### 5.2 Matrix fare table

Expected structure:

- First column is size, サイズ, 総長, or サイズ(cm).
- Optional weight column is weight, 重量, or 重量(kg).
- Zone columns include labels such as 北海道, 東京, 関東, 関西, 九州, or 沖縄.

Requirements:

- Matrix rows must be preserved for editing as `matrixView`.
- Matrix rows must be converted to `normalizedFareRows` for calculation.

## 6. Missing-field and unsupported-format errors

Import flows must provide actionable messages:

- Missing required fields should list the missing headers.
- Unsupported order CSV should show detected headers when available.
- Unsupported product CSV should state that the file cannot be recognized as product CSV.
- Missing product identity should state that required product identity fields are missing.
- Excel uploads should tell users to save as CSV until native Excel import is available.
- Image uploads should state that OCR is not supported.

## 7. Template download requirements

Template download is required for Phase 6.

Templates should include:

- ShipNavi standard order CSV template.
- Product master CSV template.
- Vertical fare table CSV template.
- Matrix fare table CSV template.
- Platform-specific guidance templates for 楽天, Yahoo ショッピング, Amazon, Shopify, BASE, STORES, and メルカリShops.

Template requirements:

- Use Japanese column labels where appropriate.
- Include required and optional field explanations.
- Include sample rows with safe dummy data.
- Include expected warnings for missing SKU, missing weight, and unsupported zones.
- Version templates so operators know which template matches the current importer.
