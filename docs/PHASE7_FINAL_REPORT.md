# Phase7 Final Report

## Completion status

Phase7 is complete for the current supported order-import scope. The implementation keeps Phase6 import and persistent-issue behavior intact while expanding platform order import coverage, runtime/documentation consistency checks, anonymized real-format fixtures, generated XLSX validation, and Japanese operator guidance.

Phase7 work stayed within the order-import enhancement boundary. It did not change fare calculation, postal-zone detection, bundle eligibility, shipment grouping, or Phase10 AI auto-repair behavior.

## Completed modules

1. **Project skills and governance references**
   - Added ShipNavi project skills under `.skills/01` through `.skills/14`.
   - Updated `.skills/00-master-agent.md` and `docs/AGENTS.md` so future agents read the project-specific governance, import, validation, UI, testing, security, performance, and release guidance before broad ShipNavi work.

2. **Phase7 missing recipient validation**
   - Added missing order-recipient/customer detection for supported order imports.
   - Missing recipient rows emit Japanese warning copy and create persistent `missing_recipient` issues.
   - Existing SKU fallback, postal-code, invalid-quantity, and persistent issue flows remain active.

3. **Order import preview metadata**
   - Order imports now return preview metadata for detected platform, imported row count, mapped fields, missing fields, and warning count.
   - Unknown order formats also return preview metadata and Japanese unsupported-format guidance.
   - Preview output supplements persistent issue creation and does not replace it.

4. **Unsupported format guidance**
   - Unsupported order files expose detected headers, missing standard concepts, and Japanese next steps.
   - Unsupported files create persistent `platform_mapping_warning` issues instead of failing silently.

5. **Platform field specifications**
   - `docs/IMPORT_SPEC.md` now documents required and optional runtime field candidates for every supported Phase7 order platform.
   - The validator compares the documented platform specs to runtime `platformFieldMappings` so docs and runtime behavior cannot drift unnoticed.

6. **Real merchant fixture expansion**
   - Expanded anonymized real-format CSV edge fixtures for 楽天, Yahooショッピング, Amazon, Shopify, BASE, STORES, and メルカリShops.
   - Edge fixtures include explanatory rows, blank rows, unsupported extra columns, split address, combined address, alternate recipient headers, alternate SKU headers, malformed quantity, missing postal, missing SKU, and product-name SKU fallback cases.
   - CSV remains the source of truth. Generated XLSX files are produced by `scripts/generate-xlsx-fixtures.js` and are not committed.

7. **Alias-only platform mapping hardening**
   - Added aliases for alternate recipient, alternate SKU, and combined address fields across supported platforms.
   - Existing aliases were not removed.
   - The validator confirms alias normalization through both CSV and generated XLSX fixture flows.

## Supported platform coverage

| Platform | Detection | Required fields | Optional fields | Missing recipient | Preview metadata | Alternate recipient | Alternate SKU | Split address | Combined address | Generated XLSX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ShipNavi標準 | Covered | Covered | Covered | Covered via shared issue flow | Covered | Not applicable | Not applicable | Not applicable | Not applicable | Covered |
| 楽天 | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered |
| Yahooショッピング | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered |
| Amazon | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered |
| Shopify | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered |
| BASE | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered |
| STORES | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered |
| メルカリShops | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered | Covered |

## Validator coverage

The Phase7 validator now checks the following order-import behavior:

- Fixture existence for normal and edge CSV files.
- Generated XLSX fixture existence after running `node scripts/generate-xlsx-fixtures.js`.
- Platform detection from actual headers rather than file names.
- Normal imports preserve `sourcePlatform`.
- Preview metadata includes detected platform, row count, mapped fields, missing fields, and warning count.
- Documented platform specs in `docs/IMPORT_SPEC.md` match runtime `platformFieldMappings`.
- Edge fixtures include required Phase7 edge IDs.
- CSV and generated XLSX flows both validate edge fixtures.
- Missing SKU fallback still warns and creates persistent `missing_sku` issues.
- Missing or invalid postal data creates persistent postal issues.
- Malformed quantity creates persistent `invalid_quantity` issues.
- Missing recipient creates Japanese warning copy and persistent `missing_recipient` issues.
- Unsupported order formats return Japanese guidance and persistent `platform_mapping_warning` issues.
- Persistent issue lifecycle behavior remains functional.
- Japanese UI scan remains intact.
- P0-1 postal-zone, P0-2 fare option filtering, and P0-3 bundle eligibility checks remain passing.

## Regression confirmation

- No `.xlsx` fixture files are tracked in git.
- CSV fixture files remain the source of truth.
- XLSX fixtures are generated from CSV by `scripts/generate-xlsx-fixtures.js`.
- `docs/IMPORT_SPEC.md` is validated against runtime `platformFieldMappings`.
- Japanese UI copy remains protected by the validator scan.
- Persistent import issues remain functional for order, product, fare, and unsupported-format flows.
- Phase10 AI auto-repair remains deferred; Phase7 only preserves rule-based suggestion metadata and persistent issue structures.

## Known limitations

- Phase7 platform mappings are header-based and fixture-driven; they do not yet support saved per-tenant custom mapping profiles.
- Combined-address handling is limited to documented alias candidates and does not perform AI-style address reconstruction.
- Unsupported format guidance suggests next steps but does not automatically repair or rewrite uploaded rows.
- XLSX files are generated fixtures for validation and are intentionally not committed.
- Carrier API behavior, fare-rule expansion, tenant isolation, and AI-assisted repair are outside Phase7 scope.

## Deferred Phase8 items

Recommended Phase8 scope:

1. Carrier-specific fare rule metadata for service, contract, size, weight, region, and effective date.
2. Carrier API integration boundaries for tracking, labels, and future rate lookup without changing transparent local calculations unexpectedly.
3. Richer postal-zone and region mapping tables with explicit audit behavior.
4. Fare recommendation explanation output that states carrier, service, size, zone, weight, and price reasons.
5. Backward-compatible validation for existing matrix and vertical fare imports.
6. Explicit regression protection around `getFareOptions`, `getZoneByPostal`, fare matrix imports, bundle eligibility, and shipment grouping.

## Final verdict

Phase7 is ready for final review. The supported order-platform import scope is covered by documentation, runtime mappings, CSV fixtures, generated XLSX validation, persistent issue checks, Japanese UI checks, and P0 regression checks.
