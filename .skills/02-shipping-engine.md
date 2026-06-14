# ShipNavi Skill 02: Shipping Engine

## 使用场景

Use for shipment grouping, bundle eligibility, postal-zone detection, fare option filtering, recommendation output, and result-center CSV export work.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md`
- `docs/ROADMAP.md`

## 保护的业务逻辑

- Fare calculation and recommendation behavior.
- Fare option filtering through `getFareOptions`.
- Postal-zone detection through `getZoneByPostal`.
- Bundle eligibility and shipment grouping through `isOrderBundleable`, `getBundleCandidates`, and `getShipmentOrderGroups`.
- Import normalization through `readImportFile`, `importOrderCsvRows`, `importProductCsvRows`, and `normalizeFareMatrix`.
- Fare matrix synchronization between `matrixView` and `normalizedFareRows`.
- LocalStorage persistence keys and migration behavior.

## 禁止事项

- Treat changes to getZoneByPostal, getFareOptions, isOrderBundleable, getBundleCandidates, and getShipmentOrderGroups as explicit business behavior changes.
- Do not silently change fare ranking, zone fallback, bundled-size estimation, or missing-product bundle rejection.
- Before implementation, state affected functions and validation plan.
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

- Recommendation output depends on product lookup, bundle grouping, shipment groups, postal zone detection, fare option filtering, and best/second-best selection.
- Valid seven-digit postal codes outside the supported mapping should remain `unknown` rather than silently falling back to address-derived zones.
