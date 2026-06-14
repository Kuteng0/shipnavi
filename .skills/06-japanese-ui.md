# ShipNavi Skill 06: Japanese UI

## 使用场景

Use for final-user Japanese copy, import summaries, warnings, issue panel text, templates, result center labels, and dashboard navigation text.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/PRD.md`
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

- Do not introduce forbidden copy: 商品主档, 不足字段, CSV导出, 推荐配送方式, 节省金额, 导入来源平台.
- Keep domain terms such as SKU, CSV, Excel, API, ID, URL, matrixView, and normalizedFareRows only where appropriate.
- Do not mix Chinese operator-facing strings into the Japanese dashboard UI.
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

- Final-user dashboard text should be Japanese for navigation, titles, buttons, tables, empty states, success/error/warning messages, import summaries, issue panels, templates, result center, and CSV/Excel export copy.
