# B2 bounded execution plan

Baselines: frontend abba612d916a745eb7f4052eccd75d182b8c71fe;
backend 0275cceec8c1b39d18c1c3d3835371e0a9477ad1. Preserve existing
session, cash and proof controls; no backend architecture or driver changes.

1. Replace shared normal-creation and CSV dialogs, including all existing callers.
   Use strict supported input projections, accessible customer/address selection
   and free text. Persist normalized intent, original operation UUID, exact selected
   context and API origin before send. Serialize cross-tab writes. Explicit retry
   uses only stored bytes; edits cannot replace uncertain intent. No optimistic order
   insertion or quote-as-acceptance. Keep existing scoped list/detail functionality.
2. Template/preview remain read-only. Confirm immutable CSV with root operationId.
   Successful response identifies confirmed orders/replayed rows. Failed response
   supplies no authoritative partial receipts: show unknown committed count and
   resume identical batch to let the server skip confirmed rows. Never equate
   receipt confirmation with labels/carrier/pricing downstream completion.
3. Minimal persisted notification projections use at/unread, bounded cursor pages,
   selected-context query keys, detail/read/read-all. Connect bell. Realtime carries
   invalidation references only; refetch persisted records on events/reconnect.
   Native websocket-only Socket.IO protocol support must be narrowly bounded and
   tested; absence/disconnection falls back to bounded polling, never fake delivery.
4. Focused adapter/intent/notification/context tests and final no-emit. Actual
   synthetic customer → order/import and notification browser journey against one
   newly owned disposable PostgreSQL instance. Mock external boundaries explicitly.
   Reuse unchanged server concurrency/receipt/notification evidence. Verify cleanup.

Compatibility: customers are tenant-owned, selected company/object checks still
apply. Client body never selects order ownership, charges, paid state or tariff.
Payment instructions/accepted financial prices belong to B4, not creation.
No new schema/dependency required. No migration rollback or production rollout in
this client batch. Master writes retain B1 uncertainty containment. Frontend
rollback must not restore ID-less creation or permissive session fallback.

Completion: one shared compatible creation/import path, immutable explicit retry
after restart, scoped operational reads/inbox, positive actual journey plus focused
negative tests. Record any unavailable infrastructure checks rather than weaken
assertions. Commit reviewed local milestones, update coverage, stop after B2.

## Implemented behavior and compatibility

- Existing CreateOrderDialog and BulkOrderImportDialog callers now use one shared
  submission implementation. Manager list and customer profile expose it; locked
  customer presets remain locked. Free-text addresses remain supported without
  customer masters. Saved address IDs come from that selected customer's scoped
  query. Normal creation supports sender/recipient contacts, service, weight,
  pieces, requested currency, reference and note. Optional scheduling/detailed
  parcel dimensions from the older form are not exposed in this minimal form;
  their backend support is unchanged and further client integration is deferred.
- No supplied charges, paid/status/owner fields or merchant COD. Quotes are not
  displayed as accepted prices. Pricing, payment instructions and invoices remain
  separate B4 work. Existing detail finance/cash controls are retained, not newly
  certified against DOM05/06 contracts.
- Before POST, persist normalized payload + UUID + full verified identity/context
  and API origin with read-back. Web Locks serialize submissions across tabs.
  Storage/locks unavailable means no send. The server receipt supplies durable
  deduplication; browser locks alone do not prove database concurrency safety.
  Explicit retries reauthorize and use identical original content. Reload/restart
  finds the original intent. Only a confirmed intent may be explicitly cleared to
  start a new action. Uncertain/conflicting intents cannot be edited or replaced.
- CSV template and preview use actual endpoints. Download is supplemented by a
  copyable server template. Maximum input is 1 MiB and preview/confirmation 100 rows.
  Successful response shows confirmed IDs and replayed-row count. An error provides
  no row receipts: committed count remains unknown, not zero. Resume the complete
  original batch; the backend skips its confirmed rows. This is not downstream
  label/carrier/pricing recovery. A conflicting receipt stays review-required.
- Order reads require a bound context, response epoch check and 15s deadline.
  Detail cache preserves its order-ID invalidation prefix while adding context;
  list/detail no longer carry the prior context's placeholder. Existing list links
  now target actual detail routes, not an unused query parameter. Receipt and inbox
  links preserve customer/warehouse/manager route families.
- Inbox uses server `at`, `unread`, `orderId` projection, 20-row cursor pages,
  detail, count, read and type-filtered read-all. Read-all applies to all matching
  pages, not just visible items. Mutations disable automatic authentication replay.
  Native websocket-only Engine.IO4/default Socket.IO authentication sends the token
  in the namespace handshake, never a URL. Relevant events invalidate queries;
  reconnect refetches persisted data. Payloads never become inbox entries. Polling
  every 30s recovers missed delivery. No exactly-once socket guarantee.
- Context/epoch changes suppress late confirmations and disconnect feed listeners.
  Cash intents and driver proof code are untouched. Local persisted contact/CSV
  data is sensitive: partitioning is not encryption; no export/logging of intents
  or credentials. New copy remains English; localization/browser matrix deferred.

## Executed evidence

1. `node --test tests/order-notification-workspace.test.cjs`: **18 distinct passing
   cases** after final adapter changes. Covers matching/conflicting identity,
   persistence/read-back failure, immutable pre-lock snapshot, restart/partial
   resume, busy lock, malformed bounds, context/epoch changes, strict authority
   allowlists, CSV/template bounds, notification projections/read contracts and
   repeated realtime invalidation. These are mocked transport/storage unit tests.
2. `tests/customer-workspace.test.cjs`: **18 passing cases** in this batch; existing
   master adapters are direct selectors. `tests/cash-contract.test.cjs`: **21 passing
   cases** because lib/orders remains a cash consumer. Their exercised functions
   stayed unchanged afterward. Total distinct client unit cases executed: **57**;
   reruns are not additional cases. Existing membership-session evidence reused.
3. `node node_modules/typescript/bin/tsc --noEmit --incremental false`: final pass.
   Focused ESLint: no errors/warnings on new adapters/dialogs/inbox and changed
   topbar/manager list subset. No application build output or dependency changes.
4. Actual desktop browser → controlled synthetic prerequisite → credential login
   → customer → structured address → normal creation with free-text pickup and
   saved receiver address → list/detail → original receipt retry → reload/reopen
   → CSV preview and two-row confirm → matching retry. PostgreSQL read-back:
   **3 orders, 3 row receipts, 2 creation intents**. Original IDs retained, no
   duplicate orders. Actual list-to-detail route defect was corrected.
5. Actual browser notification fixture retrieval/detail/read/read-all: one owned
   message visible; legacy unowned fixture hidden. Read confirmation survives
   retrieval, count becomes zero. Desktop 1440×900 and mobile 390×844 checked;
   document width equals viewport, scrollable modals preserve accessible controls.
6. Five additional actual HTTP/PostgreSQL/Socket.IO checks in the owned host:
   safe persisted notification projection; actual CSV-template response;
   changed-content import operation returns409 with unchanged order/receipt/message
   counts; native feed authenticates and receives repeated protected unread-count
   events without additional rows; reconnect invalidation retrieves the same owned
   message. These use the actual frontend frame adapter and actual backend hub,
   current HTTP authentication and notification services. No assertion that this
   proves all deployed proxies, socket revocation races or every event producer.

The test API runs actual customer/address/order/import/notification routes,
credential services, Zod validation and PostgreSQL transactions. Synthetic
prerequisites use controlled onboarding and installed permissions. Notifications
are synthetic owned/unowned fixture records, not an end-to-end dispatch producer
test. Label/storage, pricing-component seeding, carrier booking, support external
effects and Redis invalidation are explicitly mocked; no provider/AWS/storage/
Redis evidence claimed. Production ingress rate limiting/full startup untested.

Disposable run f696fc56a768 applied the unchanged **122-migration** chain to a new
empty PostgreSQL16 instance: loopback-only random port, cached image/no pull,
1CPU/512MiB/128PIDs, 256MiB exclusively owned tmpfs, no volume/bind. An initial
route-loader preparation failure had its own cleaned container; it is not another
successful test case. Both container ownership/labels and absence after removal
verified. The API and Next test hosts are bounded and stopped. Next generated
output stayed in an owned temporary source copy, not the repository/dist.

Automatic approval review rejected filesystem cleanup of
`C:\Users\Anvar\AppData\Local\Temp\cp-frontend-b2-5YFfem`; leave this source copy,
isolated build output and dependency junction for manual cleanup. Do not follow
the junction recursively. Existing blocked cleanup directories were untouched.

The template endpoint was verified, but the in-app browser did not report a saved
download. Copyable-template fallback was added afterward and type/unit checked;
its final browser rendering remains unverified because the bounded API expired.
Do not treat this as a verified filesystem download. Screenshots are external
synthetic artifacts in `frontend-b2`: order-confirmed-desktop.jpg,
notification-desktop.jpg, notification-mobile.jpg and import-mobile.jpg.

## Reused evidence and remaining gaps

Unchanged backend Order_Creation_Idempotency.md PostgreSQL concurrency, partial
import/rollback and fresh-retry authorization evidence; notification ownership/
atomic dispatch/transport and session revocation reports. No changed schema,
backend source, dependency or configuration: no broad backend reruns. Client
partial recovery/context/late-response failures are unit evidence; actual browser
import demonstrated successful recovery receipts, not injected row failures.

Failed import responses cannot expose authoritative partial row receipts/counts;
the client does not invent them. No safe abandon/reconcile API exists for a
conflicting or permanently rejected persisted creation intent, so it stays
contained. Saved-address selector loads at most50 records; larger directories
need refined selection integration. Master-write uncertainty remains B1's
separate blocked receipt/reconciliation contract. Production transport, browser
matrix, localization, S3/provider/device and release gates remain open.

Exact next task: **B3 administration/provisioning contract integration**. Inspect
existing Users/Drivers/Warehouse screens and actual controlled operational/driver
invitation, acceptance, managed-grant and owner-appointed provisioning contracts;
replace obsolete arbitrary-role/shared-driver-type paths with permission-aware
interfaces and immutable operation intents. Begin with operational invitation
creation/cancellation and authenticated acceptance, secure transient token handoff,
then scoped replacement/revocation. No browser owner-key/signing or automatic
grant expansion. Financial/cash/setup interfaces remain governed follow-on B3
milestones. Stop here; B3 was not started.
