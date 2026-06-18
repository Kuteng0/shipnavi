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

### 5.0 Built-in carrier template library

Phase11 adds a built-in carrier fare template registry for:

- ヤマト運輸 / 宅急便
- 佐川急便 / 飛脚宅配便
- 日本郵便 / ゆうパック

The registry defines carrier name, service name, supported sizes, weight rules, default zone headers, prefecture groups, template notes, and matrix template structure. CSVテンプレート and Excelテンプレート must be generated from this registry instead of separate hard-coded matrix rows.

Built-in templates are references. They use public information or standard regional grouping as a starting point, but they are not a guarantee of official or contracted pricing. Customer-uploaded contract fare tables are the source of truth and must override built-in/public templates.

日本郵便 / ゆうパック template rules:

- Supported sizes: 60, 80, 100, 120, 140, 160, 170.
- Weight limit: 25kg for every size.
- Template note: 日本郵便 ゆうパックは全サイズ共通で重量上限25kgです。
- Template note: サイズ判定は三辺合計(cm)を優先します。

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
