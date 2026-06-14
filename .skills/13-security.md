# ShipNavi Skill 13: Security

## 使用场景

Use for upload handling, anonymized fixtures, future tenant boundaries, LocalStorage risks, data export, and privacy-sensitive review.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/PRD.md`
- `docs/IMPORT_SPEC.md`
- `docs/ROADMAP.md`
- `docs/PHASE6_FINAL_REPORT.md`
- `test-fixtures/README.md`

## 保护的业务逻辑

- Fare calculation and recommendation behavior.
- Fare option filtering through `getFareOptions`.
- Postal-zone detection through `getZoneByPostal`.
- Bundle eligibility and shipment grouping through `isOrderBundleable`, `getBundleCandidates`, and `getShipmentOrderGroups`.
- Import normalization through `readImportFile`, `importOrderCsvRows`, `importProductCsvRows`, and `normalizeFareMatrix`.
- Fare matrix synchronization between `matrixView` and `normalizedFareRows`.
- LocalStorage persistence keys and migration behavior.

## 禁止事项

- Do not add real customer personal information to fixtures or docs.
- Do not weaken unsupported image/file guards or Excel guidance.
- Do not design multi-tenant behavior that allows cross-tenant data leakage.
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

- ShipNavi handles order, address, product, and fare data; fixture and export work must be privacy-aware.
- Future tenant boundaries must prevent cross-account data leakage.
