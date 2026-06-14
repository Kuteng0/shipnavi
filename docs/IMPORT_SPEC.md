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

### 3.9 Phase7 order-recipient validation

Phase7 order import enhancement must create a persistent `missing_recipient` issue when the mapped customer / recipient field is blank. This applies to every supported order platform and should use Japanese operator guidance:

- 顧客名が見つかりません。

Rows without a customer remain failed imports because `customer` is a canonical order field, but the failure must not be silent.

### 3.10 Phase7 order import preview

Order imports should expose preview metadata before or alongside the import summary so operators can confirm:

- detected platform.
- imported row count.
- mapped fields for order number, customer, postal code, address, SKU, and quantity.
- missing fields.
- warning count.

Preview text shown in the dashboard must remain Japanese and must not replace persistent issue creation.

### 3.11 Phase7 unsupported order format guidance

When an order file cannot be matched to a supported platform, the dashboard must show Japanese next-step guidance with:

- detected headers.
- missing standard concepts such as 注文番号, 顧客名, 配送先住所, SKU, and 数量.
- guidance to rename columns to the ShipNavi standard template.
- guidance to include 商品名 when 商品コード / SKU is unavailable.

This guidance must also be recorded as a persistent import issue so unsupported files do not fail silently.

### 3.12 Phase7 platform field specifications

The following tables are the canonical documented field specifications for supported Phase7 order platforms. They must stay aligned with the runtime `platformFieldMappings` in `assets/dashboard.js`; `scripts/validate-import-fixtures.js` validates these tables against runtime mappings.

<!-- phase7-platform-spec:start ShipNavi標準 -->
#### ShipNavi標準

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `orderno`; `customer`; `address`; `sku`; `quantity` |
| `optionalSignals` | platform detection optional | `postal`; `sourceplatform`; `注文番号`; `顧客名`; `郵便番号`; `配送先住所`; `数量` |
| `orderNo` | required | `orderNo`; `注文番号` |
| `customer` | required | `customer`; `顧客名` |
| `postal` | optional | `postal`; `郵便番号` |
| `address` | required | `address`; `配送先住所` |
| `sku` | required | `sku`; `SKU` |
| `productName` | fallback |  |
| `quantity` | required | `quantity`; `数量` |
<!-- phase7-platform-spec:end ShipNavi標準 -->

<!-- phase7-platform-spec:start 楽天 -->
#### 楽天

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `注文番号`; `個数` |
| `optionalSignals` | platform detection optional | `注文者名字`; `注文者名前`; `送付先氏名`; `代替受取人`; `送付先郵便番号`; `送付先住所:都道府県`; `送付先住所:都市区`; `送付先住所:町以降`; `送付先住所`; `結合住所`; `商品番号`; `商品管理番号`; `代替SKU`; `商品名` |
| `orderNo` | required | `注文番号` |
| `customer` | required | `注文者名字 + 注文者名前`; `送付先氏名`; `代替受取人` |
| `postal` | optional | `送付先郵便番号` |
| `address` | required | `送付先住所:都道府県 + 送付先住所:都市区 + 送付先住所:町以降`; `送付先住所`; `結合住所` |
| `sku` | required | `商品番号`; `商品管理番号`; `代替SKU` |
| `productName` | fallback | `商品名` |
| `quantity` | required | `個数` |
<!-- phase7-platform-spec:end 楽天 -->

<!-- phase7-platform-spec:start Yahooショッピング -->
#### Yahooショッピング

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `注文id`; `数量` |
| `optionalSignals` | platform detection optional | `お届け先氏名`; `代替受取人`; `郵便番号`; `住所`; `結合住所`; `商品コード`; `代替SKU` |
| `orderNo` | required | `注文ID` |
| `customer` | required | `お届け先氏名`; `代替受取人` |
| `postal` | optional | `郵便番号` |
| `address` | required | `住所`; `結合住所` |
| `sku` | required | `商品コード`; `代替SKU` |
| `productName` | fallback | `商品名` |
| `quantity` | required | `数量` |
<!-- phase7-platform-spec:end Yahooショッピング -->

<!-- phase7-platform-spec:start Amazon -->
#### Amazon

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `order-id`; `quantity-purchased` |
| `optionalSignals` | platform detection optional | `buyer-email`; `recipient-name`; `代替受取人`; `ship-postal-code`; `ship-state`; `ship-city`; `ship-address-1`; `結合住所`; `sku`; `代替SKU`; `product-name` |
| `orderNo` | required | `order-id` |
| `customer` | required | `buyer-email`; `recipient-name`; `代替受取人` |
| `postal` | optional | `ship-postal-code` |
| `address` | required | `ship-state + ship-city + ship-address-1`; `ship-state + ship-city`; `結合住所` |
| `sku` | required | `sku`; `代替SKU` |
| `productName` | fallback | `product-name` |
| `quantity` | required | `quantity-purchased` |
<!-- phase7-platform-spec:end Amazon -->

<!-- phase7-platform-spec:start Shopify -->
#### Shopify

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `name`; `lineitem quantity` |
| `optionalSignals` | platform detection optional | `shipping name`; `代替受取人`; `shipping zip`; `shipping province`; `shipping city`; `shipping address1`; `結合住所`; `lineitem sku`; `代替SKU` |
| `orderNo` | required | `Name` |
| `customer` | required | `Shipping Name`; `代替受取人` |
| `postal` | optional | `Shipping Zip` |
| `address` | required | `Shipping Province + Shipping City + Shipping Address1`; `Shipping Province + Shipping City`; `Shipping Address1`; `結合住所` |
| `sku` | required | `Lineitem sku`; `代替SKU` |
| `productName` | fallback | `Lineitem name` |
| `quantity` | required | `Lineitem quantity` |
<!-- phase7-platform-spec:end Shopify -->

<!-- phase7-platform-spec:start BASE -->
#### BASE

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `注文id`; `数量` |
| `optionalSignals` | platform detection optional | `購入者名`; `代替受取人`; `郵便番号`; `住所`; `結合住所`; `商品コード`; `代替SKU` |
| `orderNo` | required | `注文ID` |
| `customer` | required | `購入者名`; `代替受取人` |
| `postal` | optional | `郵便番号` |
| `address` | required | `住所`; `結合住所` |
| `sku` | required | `商品コード`; `代替SKU` |
| `productName` | fallback | `商品名` |
| `quantity` | required | `数量` |
<!-- phase7-platform-spec:end BASE -->

<!-- phase7-platform-spec:start STORES -->
#### STORES

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `オーダー番号`; `数量` |
| `optionalSignals` | platform detection optional | `購入者名`; `代替受取人`; `郵便番号`; `都道府県`; `市区町村`; `住所1`; `結合住所`; `品番`; `品番候補`; `代替SKU` |
| `orderNo` | required | `オーダー番号` |
| `customer` | required | `購入者名`; `代替受取人` |
| `postal` | optional | `郵便番号` |
| `address` | required | `都道府県 + 市区町村 + 住所1`; `都道府県 + 市区町村`; `住所1`; `結合住所` |
| `sku` | required | `品番`; `品番候補`; `代替SKU` |
| `productName` | fallback | `商品名` |
| `quantity` | required | `数量` |
<!-- phase7-platform-spec:end STORES -->

<!-- phase7-platform-spec:start メルカリShops -->
#### メルカリShops

| Runtime item | Required / optional | Candidates |
| --- | --- | --- |
| `requiredSignals` | platform detection required | `取引id`; `数量` |
| `optionalSignals` | platform detection optional | `お届け先氏名`; `代替受取人`; `郵便番号`; `お届け先住所`; `結合住所`; `商品コード`; `商品コード候補`; `代替SKU` |
| `orderNo` | required | `取引ID` |
| `customer` | required | `お届け先氏名`; `代替受取人` |
| `postal` | optional | `郵便番号` |
| `address` | required | `お届け先住所`; `結合住所` |
| `sku` | required | `商品コード`; `商品コード候補`; `代替SKU` |
| `productName` | fallback | `商品名` |
| `quantity` | required | `数量` |
<!-- phase7-platform-spec:end メルカリShops -->

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


## 7. AI導入修正アシスタント（将来対応）

CSV / Excel 取込時に、ユーザーが修正すべき問題を自動検出し、修正候補を提示する将来機能。Phase6 では AI 自動修正を実装せず、AI 修正助手の前提となる structured issue を保存し、persistent warning panel で継続表示する。

### 7.1 Purpose

- Detect import issues that require user correction.
- Preserve issues in a structured model so they can be reviewed, dismissed, resolved, or used by Phase10 AI suggestions.
- Keep original uploaded files unchanged.
- Allow corrected data to be exported again as CSV / Excel after user-approved repair.

### 7.2 Detection targets

- 必須項目の不足.
- 列名の不一致.
- 単位の不一致.
- 重量形式の不正.
- 郵便番号形式の不正.
- 配送地域の判定失敗.
- SKU / 商品コード / 品番 の対応不一致.

### 7.3 Example presentation

```text
検出した問題:
第15行に SKU がありません。

修正候補:
「商品コード」列を SKU として扱えます。

操作:
- 自動修正する
- 手動で修正する
- この警告を閉じる
```

### 7.4 Constraints

- Phase6では実装しない.
- Phase6では issue model / persistent warning panel までを実装対象にする.
- AIによる自動修正は Phase10 の対象にする.
- 自動修正する場合も、保存前に必ずユーザー確認を行う.
- 元ファイルは上書きしない.
- 修正後データは CSV / Excel として再出力できるようにする.

### 7.5 Phase6 issue model requirements

Phase6 should save missing fields, mismatched column names, and unit mismatches as structured issues. Each issue should include at minimum: issue type, source import flow, source row when available, detected column when available, user-facing Japanese message, status, and timestamps.


### 7.6 Issue to suggestion reservation for Phase10

Phase6 must define the Issue -> Suggestion data structure for Phase10, but must not connect an AI model or automatically modify user data. Phase6 may generate rule-based suggestion metadata only.

```js
{
  issueId,
  issueType,
  sourceFlow,
  rowNumber,
  sourceField,
  detectedColumn,
  suggestedField,
  suggestedValue,
  confidence,
  reason,
  status
}
```

Example:

```js
{
  issueId: "issue_001",
  issueType: "column_name_mismatch",
  sourceFlow: "product_import",
  rowNumber: 15,
  sourceField: "商品コード",
  detectedColumn: "商品コード",
  suggestedField: "SKU",
  suggestedValue: null,
  confidence: 0.98,
  reason: "商品コードはSKUとして利用できる可能性が高いです。",
  status: "pending"
}
```

Requirements:

- Phase6 only defines the structure.
- Phase6 only generates rule-based suggestion metadata.
- Do not connect an AI model in Phase6.
- Do not automatically modify user data.
- Do not overwrite the original file.
- Automatic repair is reserved for Phase10.
- Phase10 automatic repair must still require user confirmation before application.

Reserved UI copy:

- 修正候補があります。
- 商品コード列を SKU として扱えます。
- 自動修正はまだ利用できません。
- 今後のバージョンで対応予定です。

## 8. Template download requirements
## 7. Template download requirements

Template download is required for Phase 6.

Templates should include:

- ShipNavi standard order CSV template.
- Product master CSV template.
- Vertical fare table CSV template.
- Matrix fare table CSV template.
- Platform-specific guidance templates for 楽天, Yahoo ショッピング, Amazon, Shopify, BASE, STORES, and メルカリShops.


### 8.1 System-generated template requirements

Templates must not depend on manually maintained static files. They must be generated by the system from the current field definitions and import mappings.

Supported downloads:

- CSV テンプレート.
- Excel テンプレート.

Applicable scopes:

- 商品マスタ.
- 送料マトリクス.
- 配送会社.
- 注文データ.
- 楽天.
- Yahoo.
- Amazon.
- Shopify.
- BASE.
- STORES.
- メルカリShops.

Generation requirements:

- Template fields must match this `IMPORT_SPEC.md`.
- When a field definition is added, templates must update automatically.
- Templates must include required columns.
- Templates must include optional columns.
- Templates must include sample rows.
- Templates must include notes / 注意事項.
- Excel templates must include an instruction sheet.
- Excel templates must include a data entry sheet.
- CSV templates must be directly uploadable for validation.
- Excel templates must be directly uploadable for validation.
- iPhone Safari users must be able to download templates by tapping a button.

Forbidden outcomes:

- Template fields differ from actual import fields.
- Only CSV templates are provided without Excel templates.
- Only explanatory text is provided without downloadable files.
- Long-term static templates drift from importer behavior.

Template requirements:

- Use Japanese column labels where appropriate.
- Include required and optional field explanations.
- Include sample rows with safe dummy data.
- Include expected warnings for missing SKU, missing weight, and unsupported zones.
- Version templates so operators know which template matches the current importer.

## 9. Revised Phase8 shipment queue fields

Shipment Workflow MVP adds an internal `shipmentStatus` value to normalized order rows. Supported values are:

| Value | Japanese label | Meaning |
| --- | --- | --- |
| `imported` | 取込済み | Order was imported and has not yet been reviewed for shipment. |
| `pending` | 確認待ち | Operator review is required before shipment preparation. |
| `ready` | 出荷準備中 | Shipment is ready for preparation. |
| `shipped` | 出荷済み | Shipment has been completed manually by the operator. |
| `on_hold` | 保留 | Shipment is blocked by a non-critical issue or missing recommendation data. |
| `error` | エラー | Shipment is blocked by a critical import warning such as missing recipient, postal, zone, or quantity data. |

`shipmentStatus` is not a marketplace-required import column in Phase8. It is normalized internally for the shipment queue and defaults to `imported` when absent. The shipment queue may derive `on_hold` or `error` for display when unresolved order warnings or blocking recommendation issues exist.

## 10. Revised Phase8 shipment export fields

Shipment Export MVP adds a CSV export on the 出荷キュー page. The export is generated from the existing shipment queue rows and existing order rows; it does not introduce a new import schema, LocalStorage key, carrier API, tracking API, or label API.

Default export behavior:

- Rows with derived shipment status `error` / エラー are excluded.
- Rows with derived shipment status `on_hold` / 保留 are excluded.
- Exportable statuses are `imported`, `pending`, `ready`, and `shipped`.
- Shipment grouping remains provided by `getShipmentOrderGroups`; export only flattens the current shipment group rows into CSV records.

CSV columns:

| Column | Source |
| --- | --- |
| 出荷グループ | Shipment queue group ID such as `SG-001`. |
| 注文番号 | Normalized order number. |
| 顧客名 | Normalized customer / recipient name. |
| 郵便番号 | Normalized destination postal code. |
| 配送先住所 | Normalized destination address. |
| SKU | Normalized SKU. |
| 数量 | Normalized quantity. |
| 推奨配送会社 | Current recommended carrier from the shipment queue row. |
| 推奨サービス | Current recommended service from the shipment queue row. |
| 出荷状態 | Japanese shipment status label. |

Export Preview displays 出荷対象件数, 保留件数, エラー件数, and 配送会社別件数 before download. These counts are derived from the same queue rows as the export so operators can confirm blocked shipments are not included by default.
