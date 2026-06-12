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

Acceptance criteria:

- Operators can download templates from the dashboard.
- XLS and XLSX files no longer require manual CSV conversion when native parsing is enabled.
- Import summaries still include total count, success count, failure count, warning count, and warning details.
- Matrix fare imports still keep `matrixView` and `normalizedFareRows` synchronized.

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
- Operators can reject AI suggestions and download a corrected template instead.
- AI repair does not change fare calculation, postal-zone detection, or bundle eligibility directly.

## Cross-phase governance

Every phase must preserve these review rules:

- Inspect actual code paths, not only PR status or commit titles.
- Do not silently modify fare calculation, import normalization, postal-zone detection, or bundle eligibility.
- Run `node --check assets/dashboard.js` and `git diff --check` before finalizing changes.
- Update `docs/IMPORT_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/TESTING.md` when import behavior or runtime architecture changes.
