# ShipNavi Skill 04: Platform Adapters

## 使用场景

Use for marketplace order mappings and platform detection for ShipNavi standard, 楽天, Yahoo, Amazon, Shopify, BASE, STORES, メルカリShops, and future Japanese platforms.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPORT_SPEC.md`
- `docs/TESTING.md`
- `docs/ROADMAP.md`
- `docs/PHASE6_FINAL_REPORT.md`

## 保护的业务逻辑

- Fare calculation and recommendation behavior.
- Fare option filtering through `getFareOptions`.
- Postal-zone detection through `getZoneByPostal`.
- Bundle eligibility and shipment grouping through `isOrderBundleable`, `getBundleCandidates`, and `getShipmentOrderGroups`.
- Import normalization through `readImportFile`, `importOrderCsvRows`, `importProductCsvRows`, and `normalizeFareMatrix`.
- Fare matrix synchronization between `matrixView` and `normalizedFareRows`.
- LocalStorage persistence keys and migration behavior.

## 禁止事项

- Platform detection must be based on actual headers, not file name alone.
- Preserve product-name-as-SKU fallback only when needed and emit a warning/issue.
- Unsupported formats must expose detected headers and Japanese next-step guidance.
- Do not modify `assets/dashboard.js` unless the task explicitly requests dashboard business or UI implementation.
- Do not start Phase7/Phase8/Phase9/Phase10 work from a skills-only or planning-only task.

## 必须运行的检查

- `node scripts/generate-xlsx-fixtures.js` when XLSX fixtures are needed or requested.
- `node scripts/validate-import-fixtures.js` for import, issue, template, and P0 regression coverage.
- `node --check assets/dashboard.js` after any dashboard-adjacent change.
- `node --check scripts/validate-import-fixtures.js` when validation tooling is involved.
- `node --check scripts/generate-xlsx-fixtures.js` when fixture generation tooling is involved.
- `git diff --check` before finalizing.

## ShipNavi-specific notes

- Current Phase6 platform validation covers 楽天, Yahoo, Amazon, Shopify, BASE, STORES, and メルカリShops.
- Phase7 should strengthen real marketplace order imports without changing fare recommendations.
