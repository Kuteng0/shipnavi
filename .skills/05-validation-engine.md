# ShipNavi Skill 05: Validation Engine

## 使用场景

Use for fixture validation, P0 regression checks, import issue assertions, and release readiness checks.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/TESTING.md`
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

- Do not weaken P0 coverage for postal zone, fare options, bundle eligibility, or shipment grouping.
- Do not use real customer personal information in fixtures.
- Do not treat generated XLSX binaries as source of truth; CSV fixtures remain canonical.
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

- Phase6 validator result was PASS with fixture coverage for imports, templates, issues, and P0 checks.
- Fixture validation should protect PR15-PR18 retention and Phase6 behavior.
