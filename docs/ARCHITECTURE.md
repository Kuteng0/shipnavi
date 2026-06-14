# ShipNavi Architecture Notes

This document captures the runtime areas that must remain coherent when fare, import, dashboard, or result-center work changes.

## Dashboard data flow

The current dashboard is a local-first prototype. Data is normalized in `assets/dashboard.js`, persisted in LocalStorage through `setData` or `setFareTableState`, rendered into dashboard tables, and used to generate shipment recommendation results.

## Import architecture

### Order import

Order import accepts platform-specific CSV formats. The flow is:

1. Read the uploaded CSV as text.
2. Parse rows with `parseCsv`.
3. Detect platform with `detectOrderCsvFormat`.
4. Normalize rows with `importOrderCsvRows` or the ShipNavi fallback.
5. Persist orders with `setData('orders')`.
6. Re-render the orders table and show summary/toast feedback.

### Product master import

Product master import uses smart field detection. The flow is:

1. Guard unsupported image or Excel files with user-facing messages.
2. Parse CSV rows.
3. Detect product fields from `productFieldCandidates`.
4. Normalize rows through `importProductCsvRows`.
5. Preserve warnings such as SKU fallback and missing weight.
6. Persist products and show an import summary.

### Fare table import

Fare import supports vertical and matrix formats. The flow is:

1. Parse uploaded fare CSV rows.
2. Detect format with `detectFareTableFormat`.
3. Normalize vertical rows with `normalizeFare` or matrix rows with `normalizeFareMatrix`.
4. Store matrix UI state and calculation rows through `setFareTableState`.
5. Re-render carriers/fare table UI.

## Matrix fare table state

Matrix fare tables use two synchronized representations:

- `matrixView`: UI-oriented shape for displaying and editing matrix rows and zone columns.
- `normalizedFareRows`: calculation-oriented fare rows consumed by recommendation logic.

Changes to matrix editing must keep both representations synchronized.

## Recommendation architecture

Recommendation output depends on these stages:

1. Product master lookup by SKU.
2. Bundle candidate grouping by customer, postal code, and address.
3. Shipment group construction.
4. Postal zone detection.
5. Fare option filtering.
6. Best and second-best fare selection.
7. Results rendering and CSV export.

## Protected business logic areas

The following functions define sensitive business behavior and must not be changed in governance-only work:

- `getZoneByPostal` for postal zone detection.
- `getFareOptions` for fare candidate filtering.
- `isOrderBundleable`, `getBundleCandidates`, and `getShipmentOrderGroups` for bundle decisions.
- `importOrderCsvRows`, `importProductCsvRows`, and `normalizeFareMatrix` for import normalization.

## Shipment workflow architecture

Revised Phase8 adds a shipment queue view on top of the existing recommendation architecture. The queue reads shipment groups from `getShipmentOrderGroups`, builds recommendation details through `buildShipmentGroup`, and derives a display-only shipment status without changing protected fare filtering, postal-zone detection, bundle eligibility, or shipment grouping behavior.

Shipment statuses are normalized to `imported`, `pending`, `ready`, `shipped`, `on_hold`, and `error`. Japanese UI labels are 取込済み, 確認待ち, 出荷準備中, 出荷済み, 保留, and エラー. Shipments with unresolved warnings or blocking recommendation issues are displayed as 保留 or エラー in the queue.

Shipment status actions update the `shipmentStatus` field on the existing order rows stored under the current orders LocalStorage key. They do not introduce a new storage key and do not change shipment grouping or recommendation calculation.

Shipment export is a presentation/export layer on top of the shipment queue. `getShipmentExportPreview` derives exportable, 保留, エラー, and carrier counts from `getShipmentQueueRows`; `getShipmentExportRows` flattens queue groups back to order-level CSV records. This preserves existing fare calculation, postal-zone detection, bundle eligibility, and shipment grouping functions.

Shipment Results Center MVP reads the same shipment queue and recommendation outputs as the queue/export modules. `getShipmentResultsSummary` aggregates total orders, shipped, hold, error, carrier breakdown, status breakdown, and estimated savings indicators from `getShipmentQueueRows` without changing fare ranking, postal-zone detection, bundle eligibility, or shipment grouping.
