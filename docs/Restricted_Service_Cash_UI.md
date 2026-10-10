# Restricted service-charge cash workspace

Current route: /dashboard/service-cash, accessible from the authenticated topbar and ERP navigation. The common dashboard route avoids granting a driver or warehouse actor access to the manager dashboard. /dashboard/manager/service-cash redirects to it. Authority is read from the fresh server-accepted supplement, not ordinary token permissions/roles or company-wide scope.

## Working actions and exact contracts

| Screen action | Existing backend request | Result and constraints |
| --- | --- | --- |
| Scoped discovery/preflight | GET /api/orders/cash/queue?limit=20&cursor; GET /api/orders/:id/cash/preflight | Current exact decimal/currency, obligationId (price acceptance identity), sender/recipient timing, holder and pending offer shown separately. Minimal named projections. No generic order-detail read required. |
| Accepted access | GET /api/orders/cash/access | Exact selected membership, profile/permissions/kinds, entity and named owned warehouse ceiling. Mere admin/driver status grants nothing. |
| Named recipients | GET /api/orders/:id/cash/recipients?warehouseId&limit=10&cursor | Actual offer eligibility, source custody and current acceptance. Driver-to-warehouse requires durable destination evidence; warehouse-to-driver requires accepted last-mile local custody. Empty candidate pages may still have Next; no first-user inference/manual IDs. |
| Collect | POST /api/orders/:id/cash/collect | operationId, kind=service_charge, obligationId, optional warehouseId, note. Amount/currency never inputs. Sender before picked_up; recipient at out_for_delivery (driver) or at_warehouse (warehouse). Zero is not collectible. |
| Offer | POST /api/orders/:id/cash/handoff | operationId, expectedEventId, exact recipientMembershipId, explicit nullable recipientWarehouseId, kind/note. Offer does not transfer custody. One pending offer per custody event; no replacement/cancellation UI. |
| Accept | POST /api/orders/:id/cash/handoff/accept | operationId, expectedEventId, exact offerId, kind/note. Only that current eligible recipient accepts. |
| Settle | POST /api/orders/:id/cash/settle | operationId, expectedEventId, kind/note. Warehouse-held only, independent human checker. No invoice-paid or accounting side effect. |

All reads are no-store, bounded and perform no business writes/external work. Server mutation revalidation remains authoritative. Native driver app unchanged. No permission, schema, role/scope or policy expansion.

## Persistence and compatibility

One unresolved intent per API origin + complete user/tenant/tenantMembership/company/companyMembership context. Strict allowlists capture all original source/recipient IDs and note; operationId is generated once. Browser Web Locks and localStorage write/read-back are required before sending. Failure blocks sending. Explicit retry sends original content; selectors, selected orders, refresh and other tabs cannot retarget it. No automatic POST refresh/replay. Late auth-context or session-epoch responses cannot confirm. Confirmed historical receipts are kept separate from live preflight; only confirmed intent may be closed before a genuinely new action.

The old v1 legacy cash adapter (holder User IDs, no obligationId, mixed Float mirrors) now rejects without network work. Old order/warehouse/analytics cash buttons are disabled and link here. Its stored requests are preserved, not assigned to the current user or deleted. Presence of a legacy stored cash request conservatively blocks new cash actions pending separate reconciliation; this batch provides no abandonment or migration bypass. Already deployed obsolete tabs must be stopped during rollout.

Backend additive reads must roll out first; no migration. A new-ID duplicate offer still encounters the existing protected database uniqueness rejection (sanitized 500); the UI prohibits that action and offers matching original retries only. CASH_OPERATION_CONFLICT and operational/stale/permission errors are displayed distinctly; a 409 alone never authorizes abandoning an uncertain intent.

## Executed and reused evidence

19 distinct frontend cases: 16 intent/affordance cases plus 3 actual workspace static React markup cases. Executed installed Node --test tests/service-cash.test.cjs, then affected subsets for final affordance/markup and improved identity/epoch assertion. Earlier failed restart assertion compared transient receipt metadata; final assertion compares unchanged actual HTTP request/ID/content and final durable receipt. No weakened API or financial assertions. Unit API/storage/Web Locks and query data are mocked; static markup is not browser/device or actual browser-storage verification.

Seven distinct actual Fastify HTTP/PostgreSQL cases passed in the backend: selected accepted access, bounded safe named discovery/no read writes, ordinary/anonymous/foreign rejection, manipulated monetary input, exact collection/matching/conflicting retry, durable destination eligibility, parcel intake with retained cash holder, explicit offer/exact recipient acceptance, separate checker settlement, revoked supplement/fresh HTTP rejection and base-driver eligibility preservation. Three owned disposable runs cleaned up; final cp-verification-af24dcf3b553 passed all seven. All 122 unchanged migrations applied for required empty-database setup only. No obligation or custody prerequisites inserted directly. Details and earlier development failures: backend docs/security/Restricted_Service_Cash_UI.md.

Final frontend/backend tsc --noEmit passed (backend installed Node heap 6144 MiB). Focused lint of new adapter/workspace/route/intent test/sidebar files passed without warnings. Lint of modified legacy consumers/topbar/orders passed with 11 retained warnings (existing any/hooks/image/trendPeak); newly unused obsolete action predicate removed. No broad suites/builds/dependency work. Existing DOM-05/06 monetary, timing/deadline, concurrency, rollback and Socket.IO evidence reused, not added to new counts. Provider/storage/label/Redis boundaries are mocked/disabled.

## Visual and remaining boundaries

Visual verification pending: no screenshots, browser/desktop/mobile/zoom/focus or native-device claim. Shared available-space grids/min-w-0, wrapping, bounded focusable exact-detail scrolling, adaptive sections and multiline buttons are used. Loading/empty/denied/error/pending/uncertain/confirmed states are explicit; no JSON authoring or editable amount.

Unsupported: merchant COD, suspended-holder cash recovery, refunds/late corrections, cash offer cancellation/replacement, accounting/FX, invoice-paid automation, invoice issuance UI and production release gates. A confirmed cash settlement is not an invoice payment. Next separate integration task: same-base-currency manual invoice screen, retaining accepted source/context and existing immutable issuance receipts. Do not start it in this batch.
