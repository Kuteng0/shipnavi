# ShipNavi Skill 03: Import Engine

## 使用场景

Use for CSV/XLSX reader behavior, product master import, fare matrix import, import summaries, templates, and persistent import issues.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPORT_SPEC.md`
- `docs/TESTING.md`
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

- Do not regress Phase6 CSV/XLSX reader behavior.
- Do not break matrixView and normalizedFareRows synchronization.
- Do not replace persistent issue handling with toast-only warnings.
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

- Phase6 completed CSV/XLSX import support for products, orders, and fares; legacy `.xls` remains intentionally unsupported with Japanese guidance.
- Import summaries must preserve total, success, failure, warning counts, and details.
