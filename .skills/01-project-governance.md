# ShipNavi Skill 01: Project Governance

## 使用场景

Use for governance-only planning, reviews, PR scoping, and documentation/skill maintenance for ShipNavi.

## 必须读取的 docs

- `docs/AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md`
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

- Do not create duplicate governance directories such as docs/fare-governance or .skills/fare-governance.
- Keep governance-only edits inside docs/ and .skills/.
- Do not start a roadmap phase unless the task explicitly asks for implementation.
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

- `docs/AGENTS.md` is the canonical agent governance document.
- `.skills/00-master-agent.md` is the startup workflow and must point agents to these project skills.
