# ShipNavi Skill 10: Project Memory

## 使用场景

Use to preserve phase decisions, completed scope, deferred work, protected behaviors, and continuation context across ShipNavi tasks.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/ROADMAP.md`
- `docs/PHASE6_FINAL_REPORT.md`
- `.skills/00-master-agent.md`

## 保护的业务逻辑

- Fare calculation and recommendation behavior.
- Fare option filtering through `getFareOptions`.
- Postal-zone detection through `getZoneByPostal`.
- Bundle eligibility and shipment grouping through `isOrderBundleable`, `getBundleCandidates`, and `getShipmentOrderGroups`.
- Import normalization through `readImportFile`, `importOrderCsvRows`, `importProductCsvRows`, and `normalizeFareMatrix`.
- Fare matrix synchronization between `matrixView` and `normalizedFareRows`.
- LocalStorage persistence keys and migration behavior.

## 禁止事项

- Do not rely only on branch names, PR titles, or git history.
- Do not restart completed Phase6 modules.
- Do not mark deferred Phase8/9/10 items as completed.
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

- Phase6 is complete and merged; unfinished follow-up is physical iPhone Safari/device QA.
- Recommended Phase7 entry items include real marketplace order import enhancement and CI consideration for fixture validation.
