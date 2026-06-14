# ShipNavi Roadmap

## Roadmap overview

ShipNavi is moving from a local-first dashboard prototype toward a Japan-focused shipping operations SaaS. The next phases prioritize reliable real-data imports, broader marketplace coverage, carrier integration, multi-tenant operations, and AI-assisted import repair.

## Phase 6: CSV / Excel 真实数据导入与模板下载

Goal: make real merchant data import safer and easier without changing the protected fare recommendation behavior unexpectedly.

Scope:

- Add native or controlled XLS/XLSX ingestion for product master, order, and fare-table workflows.
- Keep CSV as the baseline import format and preserve current CSV parser behavior unless a migration is explicitly planned.
- Add downloadable templates for order CSV, product master CSV, vertical fare table CSV, and matrix fare table CSV.
- Add validation previews before committing imported rows to LocalStorage or future backend storage.
- Improve missing-field messages with Japanese operator guidance.
- Add sample data and template versioning.
- Create the persistent issue model required before the future AI導入修正アシスタント.
- Save missing fields, mismatched column names, and unit mismatches as structured issues.

Acceptance criteria:

- Operators can download templates from the dashboard.
- XLS and XLSX files no longer require manual CSV conversion when native parsing is enabled.
- Import summaries still include total count, success count, failure count, warning count, and warning details.
- Matrix fare imports still keep `matrixView` and `normalizedFareRows` synchronized.
- Persistent warning panels keep unresolved import issues visible until resolved or dismissed.


### Phase 6 final execution order

Phase6 must be implemented in the following order and must not be completed as one large change:

1. `test-fixtures`.
2. `fixture validation script`.
3. `persistent issue model`.
4. `CSV / XLS / XLSX reader`.
5. `商品主档导入增强`.
6. `运费矩阵导入增强`.
7. `平台订单导入增强`.
8. `模板下载`.
9. `UI 日语化`.
10. `iPhone Safari 验收`.

After every step, run:

```bash
node --check assets/dashboard.js
git diff --check
```

If a validation script exists, also run:

```bash
node scripts/validate-import-fixtures.js
```

### Phase 6 WIP commit and pause rules

Every completed module must be committed as a WIP commit before moving to the next module. Commit message format:

```text
Phase6 WIP - <module name>
```

Examples:

- Phase6 WIP - test fixtures
- Phase6 WIP - fixture validation script
- Phase6 WIP - persistent issue model
- Phase6 WIP - csv xlsx reader
- Phase6 WIP - product import enhancement
- Phase6 WIP - fare matrix import enhancement
- Phase6 WIP - platform order import enhancement
- Phase6 WIP - template download
- Phase6 WIP - japanese ui cleanup
- Phase6 WIP - iphone safari checks

If insufficient_quota, rate_limit, billing limit, usage limit, credit exhausted, 余额不足, 额度不足, or token limit occurs:

1. Stop adding new functionality.
2. Keep completed and passing code.
3. Run currently available tests.
4. Commit the current WIP if tests pass.
5. Output current status.
6. Output the next continue command.
7. Wait for quota recovery before continuing.

Continue command format:

```text
继续 Phase6 分支 phase6-real-data-import-validation。
先读取 docs/ 和 .skills/。
确认最近 WIP commit。
运行 node --check assets/dashboard.js 和 git diff --check。
从未完成的下一个模块继续，不要重复已完成模块，不要重构无关代码。
```

### Phase 6 cross-page issue acceptance

Persistent issues must be globally visible. When unresolved SKU, weight, region, postal-code, column-name, unit, product-size-estimation, or platform-field-mapping issues exist, Dashboard, Products, Orders, Carriers, and Results must show the unresolved issue count at the top of the page. Users must be able to open details, navigate to the source page, keep issues visible until resolved or dismissed, and never rely on one-time toast-only messages. Data repair must mark issues `resolved`; manual close must mark issues `dismissed`.

Required Japanese copy includes:

- 未解決の取込エラーがあります。
- 商品コードが見つかりません。
- 重量が見つかりません。
- 郵便番号の形式が正しくありません。
- 配送地域を判定できません。
- 列名を確認してください。

### Phase 6 generated template acceptance

CSV and Excel templates must be generated from current field definitions, not maintained as stale static files. Generated templates must cover 商品マスタ, 送料マトリクス, 配送会社, 注文データ, 楽天, Yahoo, Amazon, Shopify, BASE, STORES, and メルカリShops. They must include required columns, optional columns, sample rows, notes, Excel instruction sheets, Excel data entry sheets, and must be directly uploadable for validation. iPhone Safari users must be able to download them by tapping a button.

### Phase 6 product size estimation acceptance

Product master import must calculate Japanese parcel size from length / width / height aliases and 三辺合計. The classification is 60, 80, 100, 120, 140, and 160. Greater than 160 must create an oversized issue. Calculated size must be stored on the product row. The estimation process must write an issue log. Size mismatch, missing dimensions, mm-to-cm conversion, and unknown units must generate structured issues where applicable.

### Phase 6 fixture coverage acceptance

`test-fixtures/` must cover order imports for 楽天, Yahoo, Amazon, Shopify, BASE, STORES, and メルカリShops, plus business data for 商品マスタ, 送料マトリクス, 配送会社, and 注文データ. Each category must include normal data, missing SKU, missing weight, invalid postal code, invalid region, mismatched column name, unit error, header not on first row, blank rows, extra explanatory rows, currency with ¥ / 円 / comma, mixed g / kg weights, and mixed cm / mm sizes. Fixtures must validate CSV import, Excel import, field recognition, persistent issues, platform detection, fare matrix parsing, `matrixView` / `normalizedFareRows` synchronization, Japanese error messages, and iPhone Safari operability. Mock schemas and real personal information are forbidden; all fixtures must be anonymized.

### Phase 6 Japanese UI acceptance

All final-user visible UI must be Japanese. This applies to navigation, page titles, buttons, table headers, empty states, success messages, error messages, warning messages, import summaries, issue panels, template downloads, form placeholders, result center, and CSV / Excel export copy. SKU, CSV, Excel, API, ID, URL, matrixView, and normalizedFareRows may remain as domain terms, but explanations must be Japanese. Forbidden copy includes 商品主档, 不足字段, CSV导出, 推荐配送方式, 节省金额, and 导入来源平台; required replacements are 商品マスタ, 不足している項目, CSV出力, 推奨配送方法, 削減見込み額, and 取込元プラットフォーム.

### Phase 6 AI repair reservation acceptance

Phase6 must reserve the Issue -> Suggestion data structure for Phase10. Phase6 may generate rule-based suggestion metadata only and must not connect an AI model, automatically modify user data, overwrite the original file, or apply automatic repairs. Phase10 automatic repair must still require user confirmation. Reserved UI copy: 修正候補があります。商品コード列を SKU として扱えます。自動修正はまだ利用できません。今後のバージョンで対応予定です。

## Phase 7: 平台订单导入增强

Goal: expand order import coverage for Japanese EC platforms and reduce manual field cleanup.

Scope:

- Strengthen existing 楽天, Yahoo ショッピング, Amazon, Shopify, and BASE mappings with real merchant CSV samples.
- Add STORES order import mapping.
- Add メルカリShops order import mapping.
- Add marketplace-specific validation and warnings for missing postal code, missing SKU, missing recipient name, and malformed quantity.
- Preserve product-name fallback behavior when SKU is unavailable.
- Add import preview for detected platform, mapped fields, missing fields, and warning counts.

Acceptance criteria:

- Each supported platform has documented required and optional fields.
- Unsupported formats show detected headers and next-step guidance.
- Platform detection remains based on actual headers, not file name alone.

## Phase 8: 配送会社 API / 运费规则扩展

Goal: extend carrier and fare-rule capabilities while preserving transparent calculation rules.

Scope:

- Add carrier-specific rule metadata beyond size, zone, weight limit, and fare.
- Prepare integration boundaries for carrier APIs, tracking, or label systems.
- Support additional Japanese carrier services and contract-specific fare rules.
- Add richer zone tables and configurable postal-code mappings.
- Add audit-friendly fare recommendation explanations.

Acceptance criteria:

- Fare candidate filtering remains explainable by carrier, service, size, zone, weight, and price.
- Existing matrix and vertical fare table imports continue to work.
- Any change to `getFareOptions` or postal-zone logic is treated as an explicit business behavior change.

## Phase 9: 客户 / 多租户系统

Goal: evolve the local-first prototype into a multi-tenant SaaS foundation.

Scope:

- Add tenant, company, and user account concepts.
- Separate data by tenant for products, carriers, fare tables, orders, templates, and result snapshots.
- Add roles for admin, operations, and reviewer users.
- Add import history, audit logs, and rollback support.
- Prepare billing and plan boundaries after tenant isolation is reliable.

Acceptance criteria:

- Tenant data cannot leak across accounts.
- Import and recommendation history is attributable to a user and tenant.
- Existing dashboard workflows can migrate from LocalStorage to backend-backed storage through a documented migration plan.

## Phase 10: AI導入修正アシスタント

Goal: implement an AI-assisted import repair assistant that generates correction candidates from structured import issues without hiding risky data transformations.

Scope:

- Implement AI導入修正アシスタント for CSV / Excel import repair.
- Generate correction candidates from Phase6 structured issues.
- Detect missing required fields, mismatched column names, unit mismatches, invalid weight formats, invalid postal-code formats, failed shipping-zone detection, and SKU / 商品コード / 品番 mismatches.
- Suggest field mappings for unknown or mismatched headers.
- Explain missing fields and suspicious values in Japanese.
- Propose transformations such as combining address fields or converting weight units.
- Generate a preview before applying repaired mappings.
- Apply automatic fixes only after explicit user confirmation.
- Keep the original uploaded file unchanged.
- Allow corrected data to be re-exported as CSV / Excel.
## Phase 10: AI 导入修复助手

Goal: help operators repair unsupported CSV/Excel imports without hiding risky data transformations.

Scope:

- Suggest field mappings for unknown headers.
- Explain missing fields and suspicious values in Japanese.
- Propose transformations such as combining address fields or converting weight units.
- Generate a preview before applying repaired mappings.
- Save approved mappings per tenant and platform.
- Provide confidence and rationale for each AI suggestion.

Acceptance criteria:

- AI suggestions never write imported data without user preview and approval.
- All repaired mappings remain auditable.
- Operators can choose 自動修正する, 手動で修正する, or この警告を閉じる.
- Operators can reject AI suggestions and download a corrected template instead.
- AI repair does not change fare calculation, postal-zone detection, or bundle eligibility directly.

## Cross-phase governance

Every phase must preserve these review rules:

- Inspect actual code paths, not only PR status or commit titles.
- Do not silently modify fare calculation, import normalization, postal-zone detection, or bundle eligibility.
- Run `node --check assets/dashboard.js` and `git diff --check` before finalizing changes.
- Update `docs/IMPORT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/TESTING.md` when import behavior or runtime architecture changes.

## Revised Phase 8: Shipment Workflow MVP

Goal: close the daily shipping operations loop after Phase7 order import by giving operators a shipment queue that shows what can ship, what needs review, and what is blocked by unresolved issues.

Scope:

- Add a shipment status model with `imported`, `pending`, `ready`, `shipped`, `on_hold`, and `error` states.
- Add a shipment queue page for 出荷対象一覧.
- Show order count, issue count, recommended shipping method, and current shipment status per shipment group.
- Put shipments with unresolved order warnings or blocking recommendation issues into 保留 or エラー automatically.
- Keep carrier APIs, tracking APIs, label APIs, multi-tenant behavior, and AI repair out of this phase.

Acceptance criteria:

- Operators can open 出荷キュー after order import and review shipment readiness.
- Status labels are shown in Japanese: 取込済み, 確認待ち, 出荷準備中, 出荷済み, 保留, エラー.
- Existing `getFareOptions`, `getZoneByPostal`, bundle eligibility, and shipment grouping behavior remain unchanged.
- The validator covers status normalization and issue-linked queue behavior.

### Revised Phase 8 shipment export module

Shipment Export MVP extends the 出荷キュー page with CSV export and preview. It exports order-level shipment rows from the current shipment groups, excludes 保留 and エラー rows by default, and shows 出荷対象件数, 保留件数, エラー件数, and 配送会社別件数 before download.

Out of scope remains Carrier API, Tracking, Label API, Multi-tenant, and AI Repair.

### Revised Phase 8 shipment results center module

Shipment Results Center MVP adds an operations summary to the existing 結果センター. It shows 総注文数, 出荷済み件数, 保留件数, エラー件数, carrier counts for ヤマト / 佐川 / 日本郵便, shipment status breakdown, and estimated savings indicators based only on existing fare recommendation data.
