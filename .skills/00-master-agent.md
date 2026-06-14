# ShipNavi Master Agent Workflow

Use this workflow for ShipNavi repository work.

## First principles

- Inspect actual code paths before reporting PASS or FAIL.
- Do not rely only on Git log, commit titles, branch names, or PR status.
- Keep governance-only changes inside `docs/` and `.skills/`.
- Do not modify business code unless explicitly requested.

## Protected runtime behavior

Unless the user explicitly requests a business behavior change, do not modify:

- Fare calculation or recommendation behavior.
- Fare option filtering.
- Import normalization.
- Postal zone detection.
- Bundle eligibility.
- Shipment grouping.
- LocalStorage data keys or migrations.

## Canonical docs

Use these canonical documents instead of creating duplicate governance directories:

- `docs/AGENTS.md` for agent and reviewer governance rules.
- `docs/ARCHITECTURE.md` for runtime flow and protected architecture notes.
- `docs/TESTING.md` for the fare/import/dashboard/P0 review checklist.

## Required project skills

At startup for ShipNavi repository work, read this master workflow and then read
the applicable project skills below. For broad planning, review, release,
governance, or phase-transition work, read all skills `01` through `14` before
reporting or editing.

- `.skills/01-project-governance.md`
- `.skills/02-shipping-engine.md`
- `.skills/03-import-engine.md`
- `.skills/04-platform-adapters.md`
- `.skills/05-validation-engine.md`
- `.skills/06-japanese-ui.md`
- `.skills/07-mobile-admin.md`
- `.skills/08-real-data-testing.md`
- `.skills/09-data-migration.md`
- `.skills/10-project-memory.md`
- `.skills/11-ai-reviewer.md`
- `.skills/12-performance.md`
- `.skills/13-security.md`
- `.skills/14-release-manager.md`

## Standard checks

Before finalizing changes, run:

```bash
node --check assets/dashboard.js
git diff --check
```

For review-style tasks, include PASS / FAIL, the files/functions inspected, whether runtime paths remain connected, and the exact commands run.
