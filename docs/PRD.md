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

Phase6 size estimation acceptance:

- 商品マスタ取込時に 長さ / 幅 / 高さ または length / width / height / 奥行き / 横 / 縦 / 高さ / 三辺 / 三辺合計 を認識する。
- 三辺合計 = 長さ + 幅 + 高さ で日本宅配サイズを自動判定する。
- 0 < 三辺合計 <= 60 は 60、60 < 三辺合計 <= 80 は 80、80 < 三辺合計 <= 100 は 100、100 < 三辺合計 <= 120 は 120、120 < 三辺合計 <= 140 は 140、140 < 三辺合計 <= 160 は 160 とする。
- 160 を超える場合は oversized issue を生成する。
- 自動判定した size は商品データへ保存する。
- 推算過程を issue log に残す。
- 原始 size と自動判定 size が一致しない場合は warning issue を生成する。
- length / width / height のいずれかが不足する場合は issue を生成する。
- mm 単位は cm へ変換する。
- 単位不明の場合は `unit_mismatch` issue を生成する。
- 文案例: 三辺合計から配送サイズを自動判定しました。入力サイズと自動判定サイズが一致しません。サイズ単位を確認してください。三辺サイズが160サイズを超えています。

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

### 3.8 クロスページ persistent issue 表示

Phase6 では、取込エラーや警告を一度だけ toast で表示して終わらせず、未解決 issue として全ページから確認できる状態にする。

対象 issue:

- SKU 缺失 / SKU が見つからない。
- 重量缺失 / 重量が見つからない。
- 地区缺失 / 配送地域を判定できない。
- 邮编错误 / 郵便番号の形式が正しくない。
- 列名错误 / 列名を確認する必要がある。
- 单位错误 / サイズまたは重量の単位を確認する必要がある。
- 商品尺寸推算异常 / 三辺サイズの自動判定に問題がある。
- 平台字段映射失败 / プラットフォーム項目を標準項目へ対応できない。

表示要件:

- Dashboard、Products、Orders、Carriers、Results の各ページ上部に未解決問題数を表示する。
- クリック後に issue 詳細を確認できる。
- issue の発生元ページへ移動できる。
- issue を閉じるまで継続表示する。
- ユーザーがデータを修正した場合は自動的に `resolved` にする。
- ユーザーが手動で閉じた場合は `dismissed` にする。
- toast の一回限り表示だけで済ませない。
- 静默失败を禁止する。

日语文案例:

- 未解決の取込エラーがあります。
- 商品コードが見つかりません。
- 重量が見つかりません。
- 郵便番号の形式が正しくありません。
- 配送地域を判定できません。
- 列名を確認してください。


### 3.9 日语后台
### 3.8 日语后台

The dashboard is intended for Japanese operations teams and should keep Japanese labels, messages, and domain terms.

Core requirements:

- Navigation includes Dashboard, 商品管理, 配送会社, 注文取込, CSVテンプレート, 結果センター, and 設定.
- Import errors and summaries should be understandable to Japanese operators.
- Shipping domain terms such as 同梱, 運賃表, 配送会社, 郵便番号, and 注文取込 should remain consistent.

Phase6 UI language acceptance:

- 最終ユーザーが見る UI は日本語に統一する。
- 対象はナビゲーション、ページタイトル、ボタン、表格表头、空状態、成功提示、エラー提示、警告提示、導入 summary、issue panel、テンプレートダウンロード、フォーム placeholder、結果センター、CSV / Excel 出力文案。
- SKU、CSV、Excel、API、ID、URL、matrixView、normalizedFareRows などの業界・技術用語は保持できるが、説明文は日本語にする。
- 禁止文言: 商品主档、不足字段、CSV导出、推荐配送方式、节省金额、导入来源平台。
- 置換後文言: 商品マスタ、不足している項目、CSV出力、推奨配送方法、削減見込み額、取込元プラットフォーム。

### 3.10 手机端管理
### 3.9 手机端管理

The dashboard includes a responsive app navigation toggle and should remain usable on mobile devices for lightweight operations review.

Core requirements:

- Mobile navigation must remain accessible through the app menu toggle.
- Tables should remain readable through responsive table containers.
- Primary operations such as searching orders, reviewing results, and checking import status should work on small screens.

### 3.11 AI導入修正アシスタント（将来対応）

CSV / Excel 取込時に、ユーザーが修正すべき問題を自動検出し、修正候補を提示する将来機能。Phase6 では AI による自動修正は実装せず、その前提となる issue model と persistent warning panel までを対象にする。AI による修正候補生成と自動修正は Phase10 の対象とする。

目的:

- CSV / Excel 取込時に、ユーザーが修正すべき問題を自動検出する。
- 検出した問題に対して、列マッピング、単位変換、値修正などの修正候補を提示する。
- 修正前後の差分をユーザーが確認できる状態にしてから保存する。

検出対象:

- 必須項目の不足。
- 列名の不一致。
- 単位の不一致。
- 重量形式の不正。
- 郵便番号形式の不正。
- 配送地域の判定失敗。
- SKU / 商品コード / 品番 の対応不一致。

表示例:

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

制約:

- Phase6では実装しない。
- Phase6では issue model / persistent warning panel までを実装対象にする。
- AIによる自動修正は Phase10 の対象にする。
- 自動修正する場合も、保存前に必ずユーザー確認を行う。
- 元ファイルは上書きしない。
- 修正後データは CSV / Excel として再出力できるようにする。
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
