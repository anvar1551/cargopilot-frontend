# Current cash supplemental administration UI readiness (2026-10-08)

Implemented with stated evidence: /dashboard/manager/cash-access proposer/checker views, three exact supplements, current independently appointed cash-delegation.v1 ceiling/entity/named resources, eligible membership selectors, immutable proposals, independent replacement/acceptance and controlled revocation. No authority is inferred from ordinary administrator, financial, operational or driver delegation. No base roles/scopes change.

11 distinct client adapter cases and 7 new actual backend HTTP/PostgreSQL administration cases plus 2 affected concurrency/rollback cases passed (9 distinct DB cases, repetitions not added). Final both no-emit checks and focused frontend lint passed. Actual API/DB flow is separate from browser operation. Exact contracts, reruns, executed versus reused evidence and limitations: [Cash_Supplemental_UI.md](Cash_Supplemental_UI.md).

| Supported capability | Current implementation / acceptance |
| --- | --- |
| Authority/resources/recipients | GET /api/auth/company-cash-capabilities?view=ceiling or recipients&kind=proposer or checker; bounded fresh no-store snapshots; no manual IDs/prerequisite creation. |
| Exact proposals/managed access | Same read view=proposals or grants; named ownership/resources, immutable fingerprint/prior acceptance/reason and independent/stale state; unrelated grants remain separate. |
| Propose/replace | Existing POST /company-cash-capabilities/proposals; singleton approved profile and accepted ceiling, operationId/reason/expectedAcceptanceId. Pending proposal grants nothing. |
| Accept/revoke | Existing POST /accept or /revoke; independently accepted checker or authorized whole-removal ceiling, exact immutable IDs/content and current server revalidation. |
| Persistence | Original context/API origin/ID/payload stored/read-back before send, Web Locks, explicit matching retry only; late suppression and no unconfirmed abandonment. |

Partially integrated: supported DOM-05/06 service-charge action screens are still separate work. Deliberately unavailable: merchant COD monetary basis, accounting/FX, suspended-holder recovery, owner signing/automatic grants and uncertain-intent reconciliation. Awaiting external verification: new UI's rendered desktop/tablet/mobile/zoom/keyboard acceptance; no screenshots, no browser attempts, user visual review pending. Source uses corrected shared layout, not a claim of visual success. Native driver/device and real infrastructure gates remain separate.

Next proposed finite batch, not started: approved pricing/payer/CASH instruction action integration under current accepted financial profiles; separate restricted cash action screens follow. Older handoffs below are historical.

# Historical initial issuing-entity setup UI readiness (2026-10-08)

Implemented: independently appointed proposer/checker views; explicit blank currency/month/timezone and null reporting restriction; bounded owned proposal inventory, exact immutable inspection and independent decision; read-only published entity; persisted context-bound intents and explicit matching retries with late suppression. Backend discovery rollout precedes UI. No automatic appointment/grants or general settings.manage.

Contracts/evidence: [Issuing_Entity_Setup_UI.md](Issuing_Entity_Setup_UI.md). 12 distinct adapter cases and 12 actual backend HTTP-injection/PostgreSQL cases, proposal -> independent approval -> publication, no direct entity prerequisite. Unchanged setup concurrency/rollback and session/socket evidence reused. Reads are current-authority snapshots, not write authorization. Final focused lint/no-emit recorded in the report.

Visual acceptance pending: no screenshots or new browser/zoom verification. Per current user direction, unavailable rendering does not block this source-level batch. Corrected shared layout rules reused; no policy bypass/tool installation. Prior business journeys remain historical evidence, not visual acceptance of this new screen.

Unavailable: published-entity editing/deactivation, uncertain-intent abandonment/reconciliation, browser owner signing/key registration/appointment, accounting/FX/cash actions here. Real registry/secure handoff/concrete reviewed company values remain external prerequisites.

Next finite task, not started: cash supplemental administration discovery/UI using existing narrow accepted authority and independent acceptance, preserving base driver/warehouse profiles. Prior sections below are historical.

| Supported action | Exact current contract / limit |
| --- | --- |
| Setup discovery | GET /api/auth/issuing-entity-setup?view=authority or proposals&kind=proposer or checker&limit&cursor. Current owner-accepted setup authority and selected company; bounded, no-store, no writes. |
| Proposal | POST /api/auth/issuing-entity-setup/proposals; operationId/reason/explicit configuration. Matching retries retain the original result and reauthorize. |
| Independent decision | POST /api/auth/issuing-entity-setup/decisions; immutable proposalId/contentHash/approved-or-rejected/reason. Different User; pending access confers no authority. |
| Publication | Minimal current entity via setup-authority read, no finance settings bypass or edits. Existing organization supplies issuing identity. |

# Historical financial-access workspace readiness (2026-10-08)

Layout status: source-level responsive correction covers financial access and the same confirmed sizing causes in staff, driver and warehouse workspaces/shared shell. Focused lint and in-memory CSS compilation passed; final no-emit result is recorded in [Administration_Layout_Correction.md](Administration_Layout_Correction.md). Visual acceptance remains pending: no new screenshots or desktop/tablet/mobile/zoom verification. The historical flow evidence below is reused for unchanged business behavior, not proof that the reported visual defect is resolved. This earlier visual gate is superseded for the source-level issuing-entity batch by the current user direction above; verification remains pending.

Implemented: exact six-profile accepted financial ceilings, bounded no-store recipient/entity/proposal/managed-grant discovery; selected-context proposer/checker workspace, independently accepted replacements/revocation, immutable persisted intents and matching explicit retries. Operational/driver authority alone is insufficient; unrelated grants preserved. Backend read rollout precedes frontend. No mutation policy/schema changes.

Executed: 10 client cases, 10 mocked read cases, 12 distinct actual HTTP/PostgreSQL cases and one connected browser proposal/reload/retry -> separate checker acceptance -> recipient fresh login/entity read -> replacement/acceptance/revocation journey. Desktop/mobile inspected; frontend no-emit/focused lint passed; final backend no-emit passed (exit 0). Existing DOM-03 lock/concurrency/rollback and session/socket evidence reused unchanged; no new transport claim. See [Financial_Access_UI.md](Financial_Access_UI.md).

Prerequisites: independently appointed accepted finance authorities, explicit owned active entity and eligible existing company memberships/scopes. No automatic setup or grants. Deliberately unavailable: unconfirmed-intent abandonment/reconciliation, finance-only invitations, owner signing/appointment, entity setup/cash/financial business-action UI in this batch; accounting/FX remain contained. Existing legacy finance adapter gaps and auth-layout warnings remain visible in the report.

Cleanup: owned PostgreSQL/tmpfs removed, listeners stopped; frontend temp cleanup policy-blocked at cp-frontend-financial-access-ui-owned-XscTqy and left for manual cleanup. Prior blocked paths/dist preserved.

Next finite milestone after review: independently approved initial issuing-entity setup UI, existing contracts only; not started. Older handoffs below are historical.

| Current action | Contract / acceptance |
| --- | --- |
| Proposer | Existing eligible recipients, exact six server revisions and owned entity; POST proposals with immutable operationId/expectedAcceptanceId/reason. Current ceiling covers removed and replacement grants. |
| Checker | Exact proposal scope/fingerprint/reason; POST accept, different human from maker/recipient, current accepted authority. Pending access grants nothing. |
| Managed revocation | POST revoke with exact current acceptance; selected owned membership, preserved unrelated roles. Reinstatement is new independent acceptance. |
| Discovery | GET /api/auth/company-financial-access views ceiling/recipients/proposals/grants; fresh accepted finance authority, bounded context-bound cursor, no-store/minimal/no-write snapshots. |
| Missing integration | Initial entity setup, cash supplemental delegation and approved pricing/billing/manual-invoice action screens remain later batches. Existing accounting/FX/payment containment unchanged. |

# Historical warehouse workspace — implemented, focused evidence

| Action / actor | Contract / acceptance |
| --- | --- |
| Scoped reader | GET /api/warehouses?search&page&limit and /:id; shipment.view and explicit warehouse scope; bounded list and safe detail/order summaries. |
| Independently appointed provisioner | GET /api/warehouses/provisioning-authority; POST /api/warehouses with stable operationId and six normalized fields; warehouse.create, accepted warehouse-provisioning.v1 and selected-company scope. Persist/read-back before send; matching explicit retry only. |
| Existing authorized editor | PUT /api/warehouses/:id; shipment.update and explicit warehouse scope. Persisted uncertain edit is blocked, no automatic retry or claim of server receipt/version fencing. |
| Staff management | Link to existing users workspace and named approved warehouse selector; creation never extends ceiling or grants access. Separate controlled owner approval remains necessary. |
| Unsupported | Delete, assignments, generic configuration, owner signing, automatic scope grants and uncertain-edit reconciliation. Not displayed as working actions. |

Executed: 12 client cases, 8 mocked authority cases, 8 distinct HTTP/PostgreSQL
cases and a connected browser create/reload/matching retry/detail/edit/approved
staff-selector journey; desktop/mobile inspection, final no-emit and focused lint.
Reused unchanged DOM-02/delegation/custody/socket evidence. Storage/provider/Redis
boundaries mocked; synthetic pre-existing edit role/scope explicitly required.
Details: [Warehouse_Provisioning_UI.md](Warehouse_Provisioning_UI.md).
Existing auth-layout hydration warnings remain; owned test services removed,
new temporary frontend directory cleanup policy-blocked and left untouched.

Next finite milestone after review: financial-actor administration selectors/UI
under existing independently accepted ceilings. Not started.

# Historical driver administration — implemented, focused evidence

| Action / actor | Exact contract | Acceptance / limit |
| --- | --- | --- |
| Driver invitation and cancellation / independently owner-appointed driver delegator | POST /api/auth/company-driver-invitations and /cancel; immutable operationId, local-driver.v1 or linehaul-driver.v1, reason; original inviter only | Persist before send, transient one-time token; matching retry never regenerates token. Operational authority is insufficient. |
| New/authenticated existing recipient | POST /api/auth/company-driver-invitations/accept; token + operationId; new name/password or current existing identity | No credential adoption/reset; acceptance issues no session; selected login follows. No token/password persistence. |
| Managed eligibility inspection/replacement/revocation | POST /api/auth/company-driver-grants; membershipId, profileRevision, grant/revoke, reason, operationId | Zero scopes, exact managed role, current accepted driver ceiling. Active pickup/nominations/custody block type changes; revocation preserves work/history. |
| Required selectors | GET /api/auth/company-driver-delegation, /company-driver-invitations, /company-driver-grants | Fresh driver authority, bounded metadata-only no-store reads; no manual IDs, owner signer or operational-authority fallback. |

Executed: 7 mocked backend cases, 20 client intent/acceptance cases, 5 client discovery cases, 12 actual HTTP/PostgreSQL cases and the browser enrollment/login/replace/retry/revoke journey. Final no-emit and focused lint passed. Details: [Driver_Administration_UI.md](Driver_Administration_UI.md). Native
app, cash, financial and further provisioning UI remain outside this batch.


# Historical discovery dashboard (completed preceding batch)
# Current operational administration discovery dashboard

| State | Current behavior / boundary |
| --- | --- |
| Implemented / actual browser, HTTP and PostgreSQL | Scoped original-inviter invitation inventory/status and cancellation selector; accepted ceiling/profile revisions and named owned warehouse selector; manageable current grant inspection/replacement/revocation. Reload and matching receipt retry preserve original intent; narrowed/revoked authority fails closed. |
| Implemented / focused client and mocked reads | 5 new client and 9 backend cases. Final no-emit checks and focused frontend lint passed. 10 distinct real HTTP/PostgreSQL cases and one connected selector journey. Existing 20 B3 client cases, IAM concurrency/rollback/socket and B1/B2 evidence reused unchanged. |
| Remaining / deliberately unavailable | Secret regeneration, automatic email delivery and safe abandon of unconfirmed intents unavailable. Driver UI, warehouse creation, financial/cash delegation and entity setup remain later milestones. No permission/ceiling expansion or browser owner signing. |
| Compatibility / limits | Backend-first additive GET rollout; bounded pages may be empty with nextCursor after target filtering. Inventory snapshots do not authorize writes. Provider/storage/Redis boundaries mocked; production-scale and native/device behavior not verified. |
| Cleanup | Owned PostgreSQL/tmpfs removed; APIs/frontend stopped. Policy-blocked cp-frontend-discovery-owned-MDFV8l left for manual cleanup; prior blocked directories, Python runtime and dist preserved. |

Exact contracts, screenshots and evidence: [Operational_Administration_Discovery.md](Operational_Administration_Discovery.md).
Next task after external review: driver invitation and managed local/linehaul UI;
not started. Older dashboards below are historical.

# Historical B3 operational administration dashboard (superseded by discovery above)

Baselines: frontend e9daeb0e0567d2d0cd62d447777880d60d1f6f16;
backend ea985c879d7a7290df79cc29a3941830102ec9cd. Backend and driver unchanged.
Implementation checkpoint: 27ef1ed6452d4eab3cd417a0a65e451a18bc36fc.
Older dashboards/handoffs below are historical; B3 milestone 1 only is complete.

| State | Current behavior / boundary |
| --- | --- |
| Implemented, actual browser/HTTP/PostgreSQL verified | Approved clerk/dispatcher/warehouse invitation contracts; cancellation; new and authenticated existing-user acceptance; selected login, clerk customer/normal-order access; managed profile replacement and revocation. Other-company identity binding preserved. Warehouse profile exact scoped grants verified by HTTP/database, not a new custody UI journey. |
| Implemented, focused client verified | Strict three-profile inputs, context/API-bound immutable persisted operation IDs, persistence-before-send/read-back, cross-tab locks, safe errors and explicit retry, late-response suppression, no persisted tokens/passwords or credential replay. 20 distinct tests; final no-emit and focused lint passed. 12 distinct HTTP/PostgreSQL cases plus one connected browser journey; unchanged backend concurrency/revocation evidence reused. |
| Partial / missing contracts | No invitation inventory/status, managed-grant detail or ceiling/warehouse-picker API. Known IDs and manual warehouse UUIDs remain necessary; server ceiling validation remains authoritative. Local receipt is not live inventory. Unconfirmed/rejected actions stay frozen; lost token issuance cannot regenerate. Ambiguous new-user acceptance requires original token/ID and authenticated confirmation, otherwise manual review. |
| Deliberately unavailable | Driver invitations/grants, warehouse creation, financial/cash delegation and entity setup are later B3 UI milestones. Browser owner signing, arbitrary user/role mutations, global deletion, real email delivery and automatic privilege expansion remain unavailable. Backend-contained financial/provider workflows stay contained. |
| External evidence limits | Storage/providers/Redis admission/seed boundaries mocked. No production, native-device, new Socket.IO transport or email evidence claimed. Existing B1/B2 and backend concurrency/rollback/socket results reused only for unchanged source. |
| Cleanup | Owned PostgreSQL/tmpfs and test API removed; both loopback test listeners stopped. New cp-frontend-b3-owned-VZXO8v cleanup rejected by policy and left for manual cleanup; all earlier blocked directories and Python runtime untouched. |

Contracts, validation and exact limitations: [Frontend_B3_Operational.md](Frontend_B3_Operational.md).
Exact next milestone: driver invitation and managed local/linehaul membership UI,
with approved ceilings and active-work replacement blockers; no shared driverType
mutation or native driver changes. Not started. Remaining B3 provisioning/finance
milestones precede B4 pricing/payer/invoice, B5 custody and B6 cash/support/reporting.

# Historical B2 correction dashboard (superseded by B3 above)

Baseline frontend83351c85c3fbe027f8320d0ec013d8cb6f754369,
backend0275cceec8c1b39d18c1c3d3835371e0a9477ad1. No B3 or driver changes.

| Status | Current result |
| --- | --- |
| Implemented / actual-browser and PostgreSQL verified | Restored schedules, parcel measurements and route snapshots in normal creation; identical authorized retry. Interrupted CSV after first row commit -> reload -> first durable ID plus pending second slot -> exact full-batch resume, no duplicate orders.3 orders/3 receipts/2 intents. |
| Implemented / focused unit verified | Typed identity-conflict versus operational409; preserved legacy uncertain intents; strict extended allowlists; read-only status bounds/projection/fresh original authorization and late-response suppression.18 selected client and28 backend cases, no reruns summed. |
| Compatibility | Additive status GET and conflict code require backend-first rollout. Existing success payloads unchanged. Old v1 intent shapes preserved. No status-based abandon/confirmation or downstream replay. |
| Remaining omissions | Legacy itemValue and recipient-unavailable instruction not exposed; forbidden monetary/ownership/COD fields remain absent; nested address-book writes unavailable. Bounded directory selection, download filesystem verification, localization and browser matrix remain gaps. See complete input table in Frontend_B2.md. |
| External / contained | Labels/providers/storage/Redis boundary mocks only; uncertain downstream work, merchant COD/accounting/FX/corrections and production gates remain contained/unverified. Notification/concurrency/rollback evidence reused unchanged. |
| Cleanup | New owned PostgreSQL/tmpfs removed; API/frontend stopped. Policy rejected removal of cp-b2-correction-7EbPJG; leave for manual cleanup, preserve all earlier blocked locations. |

Evidence, exact API/input contract and limitations: [Frontend_B2.md](Frontend_B2.md).
Exact next task:B3 operational invitation/cancellation/authenticated acceptance and
controlled managed-grant UI; secure transient delivery and immutable request/context
controls. No automatic continuation or implementation in this correction batch.

# Frontend integration programme — current checkpoint

## Historical B2 dashboard (superseded by the correction dashboard above)

Frontend B2 starts at abba612d916a745eb7f4052eccd75d182b8c71fe; backend remains
0275cceec8c1b39d18c1c3d3835371e0a9477ad1, driver untouched. All older B1 state/
handoff statements below are historical evidence, not the current remaining task.
Implementation checkpoint: **433c7a1ced56bd92cf6056ede3c498b07761a76f**.
This dashboard checkpoint changes documentation only. Frontend authored/staged
work is clean after checkpointing; backend retains preexisting dist changes only.

| State | Current result / remaining boundary |
| --- | --- |
| Implemented and actual-browser/PostgreSQL verified | B1 customer/address selection → normal order → immutable receipt retry/reload → scoped list/detail; two-row CSV preview/confirm/matching retry; scoped inbox/detail/read/read-all/count. Three orders/three row receipts/two creation intents, no retry duplicates. |
| Implemented and unit verified | B2 normalized context/API-origin intent persistence-before-send, read-back, Web Locks, conflict/uncertain containment, restart/partial resume, late-response suppression, strict authority projection and bounded notification contract. 18 new cases, 18 affected master and21 cash cases:57 distinct client cases, not a sum of reruns. Final no-emit and focused lint pass. |
| Real transport evidence | Actual native EIO4/Socket.IO adapter authenticated against the owned backend hub; repeated protected count signals and reconnect caused persisted retrieval without extra message rows. Five focused additional HTTP/database/transport assertions. No deployed infrastructure or exactly-once delivery claim. |
| Partially verified | Template endpoint works; filesystem download not confirmed by in-app browser. Copyable server-template fallback added and type/unit checked, final browser rendering unverified after bounded API expiry. Optional scheduling/detailed parcel dimensions, larger address-selection directories and localization remain client gaps. |
| Deliberately unavailable | Merchant COD, accounting/FX, financial corrections and uncertain real-provider replay remain backend-contained. Uncertain master writes and conflicting/permanently rejected creation intents lack safe abandon/reconciliation contracts. No fake success or financial authority workaround. |
| Remaining integration | B3 controlled administration/provisioning; B4 approved pricing/payer/CASH instructions/manual invoice; B5 restricted custody/proof viewing; B6 service cash/support/reporting/current finance contracts; B7 cross-workflow/browser matrix. Legacy screen presence is not restored compatibility. |
| External gates | Storage/providers/native devices/distributed recovery and production release gates retained. Label/storage/carrier/Redis effects explicitly mocked in B2 acceptance. Both owned PostgreSQL instances removed with verified ownership/tmpfs cleanup; test servers stopped. |

Full contracts, executed versus reused evidence and limitations: [Frontend_B2.md](Frontend_B2.md).
Automatic approval review rejected cleanup of the owned frontend temporary copy
`C:\Users\Anvar\AppData\Local\Temp\cp-frontend-b2-5YFfem`; leave its isolated
output and dependency junction for manual cleanup. All earlier blocked directories
remain untouched. No remaining B2 database storage or test listeners.
Exact next task: **B3 operational invitation creation/cancellation, authenticated
acceptance and controlled managed-grant replacement/revocation**, starting from
actual Users/Drivers/Warehouse contracts. Secure transient handoff, immutable
requests and context guards; no browser owner signing or automatic grant expansion.
Financial/cash/setup provisioning follow the separately approved B3 milestones.
B2 stops here; none of B3 implemented in this batch.

## Historical B1 baseline

Baseline backend f363ee54dc68d6d73d6b385b7cc43a4fc47a7417; frontend
5bfae6ed9e4b9f1ec48883788bc5dee220f860c9; driver
b7040eadf47850fa6f8392a45c6b7370c03125da. Frontend/driver worktrees clean at inspection;
backend has preserved dist changes only. No AGENTS.md found in either client or their
parent directories; backend security architecture/contracts guide integrations.
Existing membership selection, context cleanup, cash intent and driver PNG/proof
identity safeguards are retained. Driver implementation is deferred.

Backend compatibility checkpoint: `0275cceec8c1b39d18c1c3d3835371e0a9477ad1`
fixes only customer HTTP schema composition, with its regression and evidence.
Frontend B1 implementation is the local commit containing this document; no push.

## Finite batches and completion criteria

1. **Workspace + customer/address master workflow (B1 completed):** selected-context
   shell, accessible reusable states/design tokens; scoped search/list/detail and
   create/edit/address/default/delete contracts. Actual adapters, no fake success.
   Missing master-write idempotency means ambiguous writes cannot auto-replay.
2. **Orders/import + operational notifications (B2 implemented, limits above):** immutable context-bound order/import
   operation IDs, reference consistency, partial row results, authoritative refresh;
   notification inbox/list/read/count with recipient/context partitioning.
3. **Administration + provisioning:** operational/driver invitations, acceptance and
   controlled grant replacement/revocation; warehouse creation; financial/cash/setup
   proposal and independent acceptance. Operator keys/signing stay out of browser.
4. **Pricing → payer/instruction → invoice:** draft/version approval, immutable policy,
   exact accepted/revised price, explicit payer/CASH timing, same-base manual issuance.
   Independent identities, immutable retry intents, contained actions clearly disabled.
5. **Warehouse/dispatch custody + proofs:** restricted discovery/preflight, nominations
   versus acceptance, state/event fences, exact parcels/recovery reason, authorized proof
   viewing. Driver capture/replay is a separate driver batch, not dashboard simulation.
6. **Service cash + operational oversight:** narrow cash queue/preflight, durable offer/
   acceptance and independent warehouse settlement; support and scoped reports; finance
   read/authoring contract alignment without enabling held accounting/provider execution.
7. **Cross-workflow browser acceptance:** realistic least-privilege actors, denied/empty/
   loading/stale/uncertain cases, keyboard/mobile, context switches and restart. Production
   storage/provider/device/infrastructure verification remains a separate release gate.

Every batch updates this matrix, reports evidence at its actual level, and stops at its
defined boundary. No backend architecture expansion, guessed permissions/policy or worker
screen unless a concrete authorized user action exists.

## Backend-to-client coverage matrix

Paths below are verified backend paths/prefixes from src/index.ts and module transports;
authority also includes fresh selected context, resource scope and state checks. Existing
screens are present code, **not claims of current contract compatibility**. B=planned batch.

| Capability / actor and authority | Actual contract and persistence | Existing interface / status / batch acceptance |
| --- | --- | --- |
| Selected login / all identities | /api/auth/login credential-verified 409 choices then companyMembershipId; exact refresh context, logout lineage | Login/Providers/api implemented previously; B1 preserve, managed operational profiles must reach workspace; no credentials persisted beyond existing bound session. |
| Controlled tenant onboarding / installation owner | Internal signed permit only, no anonymous registration; reviewed real key/intent required | No browser provisioning/signer; deliberately unavailable to ordinary admin. B3 explanatory prerequisite, never fabricate endpoint. |
| Operational invitation / accepted delegator | POST /api/auth/company-invitations, /cancel, /accept and company-operational-grants; operationId/profile revision/typed warehouse ceilings; one-use secret delivery | B3 milestone 1 implemented: Users controlled workflow and public recipient acceptance, transient private token handoff, immutable persisted requests and scoped member directory. Browser/HTTP/PostgreSQL verified; additive discovery now supplies invitation/status, manageable grants and named accepted-ceiling resources. See Operational_Administration_Discovery.md. No email delivery claim. See Frontend_B3_Operational.md. |
| Driver invitation / separate driver delegator | company-driver-invitations, /cancel, /accept and company-driver-grants; exact local/linehaul membership eligibility; no implicit scopes | Drivers/edit shared User.driverType obsolete. B3 accepted restricted membership type and active-work replacement blockers; driver native work deferred. |
| Historical planned financial/cash grant and initial entity setup / owner-appointed makers/checkers | company-financial-grants and company-cash-capabilities proposals/accept/revoke; issuing-entity-setup proposals/:id/decisions; independent User and accepted ceilings | No matching interfaces. B3 governed profiles, removed/replacement ceilings, exact acceptance IDs; no general settings.manage or automatic grant expansion. |
| Customers / clerk or authorized customers.read/write | /api/customers GET q/type/page/limit and :id; POST/PATCH strict fields, DELETE204; tenant-owned masters may span companies but existing object checks remain | B1 implemented and browser verified: scoped list/search/create/detail/edit/delete. No inferred exclusive company ownership or ownership request fields; uncertain writes remain contained. |
| Addresses / authorized customer actor | /api/addresses GET customerEntityId/q/take (max50, array, not page/limit); POST requires customer; PATCH cannot move owner; customer PATCH defaultAddressId | B1 implemented and browser verified: bounded search/create/edit/default/clear/delete with exact customer identity and unknown-write containment. |
| Warehouse provisioning/access / explicitly appointed admin or scoped staff | /api/warehouses POST warehouse.create + durable authority + operationId; GET list/:id shipment.view scoped, PUT shipment.update restrictions | Warehouse/create dialog present but no durable provisioning contract. B3 no automatic access/ceiling; B5 actual scoped read/consumer compatibility. |
| Order creation/list/detail/export / authorized shipment actor | /api/orders POST immutable operationId/normalized refs; GET scoped filters; :id and export.csv; no client paid/amount/owner authority | B2 shared creation integrated across existing callers, master refs/free text and durable original retry; list/detail verified, actual route links corrected. Export unchanged, not newly verified. Quotes not accepted prices. Schedules, per-parcel measurements and safe route snapshots restored by B2 corrections; remaining omissions explicitly listed in the current input table. |
| CSV import / shipment.create | /api/orders/import/template.csv,/preview,/confirm; stable identity+same CSV, independent per-row success/replay | B2 template/preview/confirm and immutable original batch integrated. Successful receipt lists IDs/replayed rows; new original-context read-only status recovers committed IDs/pending slots after failed response/reload. Identical batch resumes unfinished rows; downstream recovery remains separate. |
| Quotes/tariffs / accepted pricing actors | /api/pricing/quote,/quote-options; tariff-plans CRUD draft only; :id/versions and decision with contentSha256/generation/operationId | Pricing screen draft editor exists, approval wiring missing. B4 approved snapshots/candidate precedence, separate reviewer, reject draft/foreign fallback. |
| Billing policy / pricing-maker/checker | /api/pricing/billing-policies POST, /decision, /:id read; immutable version/hash/op ID | Missing. B4 explicit routes/country/zone/currency/rounding/tax/state policy; no inferred defaults or mutable approved history. |
| Payer and cash instruction / accepted billing operator | /api/pricing/orders/:id/bill-to and service-payment-instruction; billToId/CASH/SENDER or RECIPIENT/evidence/reason/opID | Missing. B4 records authoritative payer/timing before acceptance, handles CASH_COLLECTION_WINDOW_CLOSED; no online→cash conversion. |
| Price acceptance/revision / billing operator + independent price checker | /api/pricing/orders/:id/price-acceptance,/price-approval; exact strings/source IDs/hash/opID; payment activity/invoice/deadline freeze | Missing. B4 distinct proposed/approved, immutable retry, no payable Float edit or late adjustment. |
| Driver assignment/status / dispatcher or exact eligible driver | /api/orders/assign-driver-bulk with expectedStates; driver-status supported transitions, generic status changes contained | Dispatch/warehouse screens exist but legacy status actions. B5 partial batches, fresh state and membership; no company scope workaround. |
| Custody discovery/actions / exact warehouse scope or driver membership/action key | /api/orders/custody-work cursor, /:id/custody GET/POST; operationId, expected state/event, complete parcels; offers versus accepted custody | No current custody workspace. B5 actionable restricted lists/preflight, explicit acceptance, reasoned physical receiving after outgoing suspension. Listing never grants mutation authority. |
| Proofs / authorized parent-order actor | /api/orders/:id/proofs read, proof-submission-capability and delivery-proof; PNG/size/dimensions, submissionId immutable content, server time | Order proof viewer present; driver native durable path exists. B5 viewer contract, driver coordination only; no SVG, context-free signing or invented retry IDs. |
| Service charge collection/transfer/settlement / accepted supplemental cash actors | /api/orders/cash/queue; /:id/cash/preflight; collect,handoff,handoff/accept,settle; obligationId/event/operation/exact membership and amount strings | Legacy cash-intent protections exist, current DOM05/06 contract missing. B6 no resubmission after ambiguous outcome or context switch; parcel custody does not move money; separate warehouse checker. |
| Manual invoice / independently provisioned issuer | POST /api/invoices/issue with orderId/priceApprovalId/operationId/reason; GET /:orderId; same entity base currency, configured state | Finance receivables/order views exist, issuance wiring missing. B4 durable original receipts, zero/foreign/superseded rejection. Held outbox is not accounting or payment. |
| Notifications / selected recipient | /api/notifications GET bounded cursor/type, unread-count, :id, :id/read, read-all; exact recipient/company context; realtime uses existing IDs | B2 bell/inbox/detail/read/read-all/count integrated and browser verified. Real transport references invalidate persisted queries; reconnect/poll recover missed signals without appending duplicates. |
| Support / relevant support keys and company/object scopes | /api/support/tickets/summary/assignees, ticket status/assign/notes/messages; queues/rules mutations and stream contained where unsupported | SupportDashboard present. B6 validate actual status body (current client sends /status), linked order/assignee ownership and safe attachments; no live stream claim. |
| Operational reporting / scoped shipment/report permission | /api/analytics summary/trend/warnings/finance-queue, selected context/cursor/cache; stream/refresh rules | Analytics/live map/dashboard present. B6 query/cache partitioning, no numeric mixed-currency truth or global realtime fallback. |
| Existing finance module / explicit legal-entity permissions | /api/finance entity/accounts/periods/journals/rules/subledger/reports paths; accepted immutable rules/authority and exact strings | FinanceControlCenter and 16 workspaces inspected; substantial real API code, but broad legacy settings/payment/post controls are not restored. B6 align current reads and supported authoring receipts; disable policy-contained execution visibly. |
| Entity/catalog and periods / finance.settings.read, finance.periods.read | GET /api/finance/legal-entity, /setup/catalog, /periods; selected company/entity filters and safe projections. Reads cannot configure. General settings/manage and period mutation remain policy-contained. | FinanceSetupWorkspace/PeriodsWorkspace present. B6 align read-only state, owned filters/cursors; entity publication goes through B3 independent setup, not legacy settings writer. |
| Account/chart authoring / finance.accounts.read/manage | /api/finance/accounts and /accounts/bootstrap; direct creation requires operationId/normalized context-bound receipt and chart serialization | Accounting/FinanceAccountsWorkspace present; B6 stable direct-account intent and original receipt. These keys are not silently added to approved DOM-03 profiles. No implied posting authority. |
| Journals / finance.journals.read/create | /api/finance/journals and /:id; exact balanced owned references, durable draft identity. /post and /reverse keys do not override accepted policy/immutability checks | FinanceJournalsWorkspace present. B6 align actual draft/read receipt and contained posting/reversal outcomes; no manufactured manual-approval eligibility. |
| Posting configuration / finance.postingRules.read/manage | /api/finance/posting-rules, /:id, /:id/versions, /:id/status; immutable version/acceptance ownership; execution requires separately approved rule/accounting basis | FinancePostingRulesWorkspace present. B6 scoped reads and supported version authoring; missing independent acceptance policy remains explicit rather than generic enable toggle. |
| Subledger / finance.receivables.read, finance.payables.read | /api/finance/receivables, /receivables/unapplied-cash, /payables; tenant/entity-bound pagination and exact decimal projections | Receivables/Payables workspaces present. B6 owned filters/cursors and response contract tests; no automatic invoice-paid or journal creation. |
| Treasury, reconciliation, settlements, carrier bills / corresponding finance.treasury.read, finance.bankReconciliation.read, finance.settlements.read, finance.payables.read | Existing /api/finance treasury/bank/settlement/carrier-bill reads; write/approval/execution paths remain subject to contained source/provider/accounting policy | Treasury/BankReconciliation/Settlement/CarrierBill workspaces present. B6 preserve verified reads; unavailable manage/approve/execute controls cannot show successful placeholder outcomes. |
| Source exceptions and trial balance / finance.exceptions.read, finance.reports.read | GET /api/finance/source-events, /exceptions, /reports/trial-balance; authoritative owned source/account/query restrictions. POST /source-events/:id/retry is not unrestricted repair | Exceptions/Reports workspaces present. B6 scoped minimal inventory/report, exact currency treatment; generic replay stays unavailable where durable accepted basis is absent. |
| Worker recovery inventory / authorized shipment.view | /api/orders/:id/downstream-recovery read; sandbox repair only under existing accepted authority/permission contract | Missing user-facing read; B6 minimal status panel if needed. No provider replay, claims/resets or fabricated success. |
| Merchant COD / accounting / FX / real provider recovery | Explicitly backend-contained, missing approved provenance/mappings/correction/provider guarantees | Deliberately unavailable. No enabled UI, no fake totals or client workaround. Not prerequisites for customer B1 or domestic service-charge invoice UI. |

## Design contract

Keep existing Next/Radix/TanStack components and finance functionality. Use a restrained
navy navigation rail, light neutral canvas, white bordered surfaces, blue action/focus
accent and semantic status colors paired with text. System UI typography (no network font
dependency), 4px spacing scale, 12px cards/8px controls, 40px touch targets and efficient
44–52px rows. Page header → scoped summary → search/filter → table/detail → explicit action.
No decorative KPI/fake data, full-record projections or success before confirmation.
Reusable loading/empty/denied/error/uncertain states; errors show safe guidance, not raw
server exceptions. Keyboard labels, focus-visible, live regions and Radix focus traps.
Subtle 160ms entrance/feedback with reduced-motion override. Mobile table scroll/details
stack/forms fit viewport; no hidden required actions. Existing shared en/ru/uz
infrastructure remains; new customer workspace copy is English in B1. Its Russian/
Uzbek localization is an explicit remaining client gap, not verified compatibility.

## Historical B1 execution and evidence

Plan recorded before implementation. No dependency changes. UI adapters use selected
context and actual endpoint shapes. Customer/address POST/PATCH/DELETE lack durable
backend request receipts: local intent identity is **not** server idempotency. Persist
before send; suppress automatic replay and parallel/double submissions, keep uncertain
intent across reload and partition by API origin + user/tenant/company membership. No
ownership fields or secret/token in intent records. Persisted contact payload is local
browser data; do not export/log it. Read refresh/reconciliation cannot replace intent.

### Current capability status

| Status | Capability and evidence |
| --- | --- |
| Implemented and browser verified | Scoped customer search/list/detail/create/edit/delete; address create/edit/default selection/clear/delete and authoritative reload. Actual customer/address routes and PostgreSQL, not mock success screens. Desktop 1440×900 and mobile 390×844 inspected; modal Escape restores initiating focus. |
| Implemented and unit verified | Strict request allowlists, minimal response parsing, take=50 address bounds, 20-row customer pages, exact address/customer relationship; durable local persistence/read-back, immutable intent, cross-tab lock, no auto-replay, late-response/context suppression and recovery partitioning. Fresh backend authorization remains authoritative. |
| Existing protections retained | Credential-verified selection, exact refresh context, auth-epoch query-cache cleanup and original cash intent protections. Actual backend userId alias now normalized before token/context verification; conflicting id/userId rejects. Managed approved operational/financial role codes route to ERP without granting permissions. Driver/proof source untouched. |
| Missing integration | B2–B7 above, including controlled admin, governed finance, custody/cash, invoice and support contract alignment. Presence of legacy screens is not readiness. Inline customer-profile order/import controls are replaced by an explicit pending-integration notice; old dialogs remain elsewhere pending B2. |
| Deliberately unavailable | Merchant COD, accounting execution, FX, unapproved monetary corrections and uncertain real-provider recovery. Browser never supplies operator keys, financial authority or missing policy. |
| External/compatibility gates | Real backend deployment/runtime, browser matrix, device/S3/provider/distributed behavior, localization and existing production release gates. Backend master-write receipts/reconciliation absent. No uncertain master intent can be acknowledged as failed or automatically replayed; storage/lock API unavailability disables writes. |

### Executed evidence

- `node --test tests/customer-workspace.test.cjs tests/membership-session.test.cjs tests/cash-contract.test.cjs`: **59 distinct cases passed**. New master adapters/intent plus actual projection/no-replay/routing regressions; existing session/cash cases rerun because shared auth/API consumers changed. No driver tests or broad unrelated suites.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed after final UI corrections, no repository build output generated.
- Focused ESLint on changed TS/TSX: no errors; 15 existing `no-explicit-any` warnings in shared auth/API/session code. Final changed UI subset: no warnings/errors.
- Actual browser flow: synthetic controlled onboarding prerequisite → credential login → create customer → create address → set default → edit customer/address → reload → scoped search and empty state → clear default → delete address → delete customer. DB read-back before deletion: one customer, one address, one same-customer/tenant default; after deletion: zero customers and zero addresses. No simulated frontend success. No horizontal document overflow at mobile size; keyboard focus restoration verified. Reduced-motion handling reviewed in source, not preference-emulation evidence.
- Backend route-load defect corrected minimally: Zod 4 cannot partial a refined object. Composition moved before identical refinement; 16 focused backend cases passed and final 6GiB no-emit passed (default heap exhausted). Existing migrations/tenant schema unchanged.
- Loopback-only disposable PostgreSQL, resource limited, unique ownership labels/tmpfs; test host env allowlisted, no dotenv, workers, existing endpoints or `.env` files. Two setup attempts failed at the route-load defect and cleaned their containers; third hosted actual routes. Production auth rate-limit/Redis ingress and full backend startup were not tested. Next dev ran from an owned source copy with installed node_modules junction, no env files or dependencies copied. Screenshots are external artifacts, not committed generated output.

All three exclusively owned database containers were removed with verified labels;
their tmpfs storage disappeared and no volumes/binds were created. Both local test
servers stopped. Automatic approval review rejected filesystem cleanup: leave
`C:\Users\Anvar\AppData\Local\Temp\cp-frontend-b1-74AQ9f` (including its dependency
junction), `cp-browser-owned-7p1udf` and `cp-browser-owned-SnnEXs` under the same Temp
directory for manual cleanup. Do not recursively follow the dependency junction.
The previously blocked dependency cleanup directory remains untouched.

Desktop/mobile screenshots: external visualization folder `frontend-b1`,
`customers-desktop.jpg`, `directory-desktop.jpg`, `customers-mobile.jpg` and
`address-mobile.jpg`. These contain synthetic records only.

### Historical B1 API/client changes and handoff

No backend ownership/API field expansion. Required supported-browser Web Locks and
local storage; receipt-less writes use 15s request deadlines without automatic refresh/
replay. Local IDs are client recovery references, never server operation IDs. Persisted
contact intent is sensitive local browser data: do not export/log it; partitioning is
not encryption. Header shows actual selected IDs (display names absent from single-
membership response), with full desktop tooltip. Existing default address/created-date/
linked-user/scoped order counts retained; no unrelated order queries added.

Driver coordination gap confirmed by source: its `validateSession` still passes
the backend `userId` projection directly to `cashContext`, which requires `id`.
Frontend now normalizes that explicit alias and rejects conflicting identities;
driver correction and device verification are deferred, not claimed compatible.

Historical B1 next task (completed in B2 above): inspect and replace existing order/import submission contracts
with immutable context-bound operation IDs, preserve CSV/payload across uncertain retries,
wire authorized customer/address references, partial-row results and original server
receipts; implement scoped notification inbox/list/read/count. Prove real synthetic
customer → normal order/import and notification retrieval plus conflicts/context changes.
Do not implement governed pricing/cash/provisioning in that batch. B1 stops here.
