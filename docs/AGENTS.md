# ShipNavi Agent Governance

This document is the canonical governance guide for agents and reviewers working on ShipNavi. It replaces the duplicated `docs/fare-governance/` and `.skills/fare-governance/` layer.

## Core operating rules

- Inspect actual code paths, not only Git history, commit messages, PR titles, or GitHub status.
- For governance-only tasks, restrict edits to `docs/` and `.skills/`.
- Do not modify business code unless the user explicitly asks for a business behavior change.
- Do not silently change fare calculation, fare option filtering, import normalization, postal zone detection, bundle eligibility, or shipment grouping.
- If a business behavior change is requested, state the affected functions and validation plan before relying on the result.

## Required Skills

ShipNavi agents must use `.skills/00-master-agent.md` as the startup workflow.
For broad planning, review, release, governance, or phase-transition tasks, read
the following project skills before reporting or editing:

1. `.skills/01-project-governance.md`
2. `.skills/02-shipping-engine.md`
3. `.skills/03-import-engine.md`
4. `.skills/04-platform-adapters.md`
5. `.skills/05-validation-engine.md`
6. `.skills/06-japanese-ui.md`
7. `.skills/07-mobile-admin.md`
8. `.skills/08-real-data-testing.md`
9. `.skills/09-data-migration.md`
10. `.skills/10-project-memory.md`
11. `.skills/11-ai-reviewer.md`
12. `.skills/12-performance.md`
13. `.skills/13-security.md`
14. `.skills/14-release-manager.md`

## Fare-project governance scope

Fare-related governance covers these runtime areas:

1. Order CSV import and marketplace field mapping.
2. Product master import and smart field detection.
3. Fare table import, matrix fare tables, `matrixView`, and `normalizedFareRows`.
4. Postal code or address to shipping-zone detection.
5. Fare candidate filtering and recommendation generation.
6. Bundle candidate and shipment group generation.
7. Dashboard import, preview, results, and CSV export flows.

## Non-goals for governance-only work

Governance-only changes must not directly modify:

- Fare calculation formulas or recommendation behavior.
- Fare candidate filtering rules.
- CSV, Excel, or matrix import parsing behavior.
- Bundle eligibility decisions.
- LocalStorage keys, data migrations, or dashboard interaction behavior.

## Required review posture

When reviewing or changing fare-related documentation, skills, or code, confirm whether the relevant functions are still connected to their runtime entry points:

- File input submit handlers.
- Import normalization functions.
- `setData` or `setFareTableState` persistence calls.
- Table render functions.
- Result-center shipment and recommendation generation.
- CSV export handlers.

## Reporting expectations

Review output should include:

- PASS / FAIL.
- Files and functions inspected.
- Whether the functions are still connected to submit handlers, render functions, or result generation paths.
- Exact commands run and whether each command passed, failed, or was blocked by an environment limitation.
