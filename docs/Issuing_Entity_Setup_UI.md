# Initial issuing-entity setup workspace

Baselines backend 798cc26916c5d1ada441f54c859007c6b63635c8 / frontend 66cbc31d4b834888a045016e021375e28c7c761b. Finite batch, no new policy/schema/dependency. Roll out backend discovery first.

## Working implementation and contracts

/dashboard/manager/entity-setup is visible for finance.entitySetup.propose or finance.entitySetup.approve. Visibility is not authority: every API requires current selected context and separately owner-appointed issuing-entity-setup.v1. Ordinary administration/financial delegation is insufficient. Proposers see their own proposals; checkers see owned company records. Company identity comes from the existing owned organization; no fabricated legal/tax fields.

| API | UI behavior / boundaries |
| --- | --- |
| GET /api/auth/issuing-entity-setup?view=authority&kind=proposer\|checker | Current accepted authority, supported server currencies (initially UZS/USD/CNY), company name and existing minimal publication. No-store, no writes. No entity prerequisite. |
| GET same path view=proposals&kind&limit&cursor | Bounded exact-content inventory with proposer identity/name, immutable hash/configuration, independence, decision and reasons. Context/membership-bound cursor; no manual-ID fallback. |
| POST /api/auth/issuing-entity-setup/proposals | Stable operationId, reason, explicit baseCurrency/fiscalYearStartMonth/timezone and reportingCurrency:null. All configuration controls start blank. No implicit company defaults. |
| Existing GET /proposals/:proposalId | Owned exact-content read; foreign/not-found now preserves its intended 404 instead of accidental 500. UI inventory supplies equivalent inspection without an extra lookup. |
| POST /api/auth/issuing-entity-setup/decisions | Original proposalId/contentHash, explicit approved/rejected decision and reason; different User, current maker/checker authority. Published entity and receipt/audit commit atomically under existing rules. |

Published entities are read-only here. Pending, approved, rejected, already-configured, unavailable authority and uncertain local receipts are distinct. A matching historical retry reauthorizes and returns the original result; new setup when configured is rejected. Replacement/edit/deactivation, general settings.manage, accounting/FX/cash, browser owner signing and prerequisite appointment remain unavailable.

## Immutable intent persistence

cp_entity_setup_v1 partitions non-secret intents by API origin, user/tenant/tenant membership/selected company membership context and propose/decide kind. Browser Web Locks and storage read-back are required before send. Original ID, normalized content and inspected decision snapshot persist across reload and explicit matching retry. Refreshed selectors never replace an uncertain intent. No automatic replay; no unconfirmed deletion/abandon. Only confirmed actions may be finished. Context/auth-epoch guards suppress late results; mismatch receipts remain uncertain. Server mutation authorization remains authoritative.

## Evidence

12 distinct adapter cases passed across initial 11 passes and one affected corrected assertion rerun. The assertion originally compared local receipt metadata; it now compares immutable payload/operation ID. Cases cover explicit configuration/no defaults/null reporting/unknown ownership, normalized restart retry, conflict, write/read-back failure, late/foreign context, uncertain retry, exact decision receipt, operational-vs-identity conflict, minimal/stale discovery and lock denial. Storage/API/browser lock boundaries mocked; actual canonicalIntent implementation used.

12 distinct actual backend HTTP-injection/PostgreSQL cases passed after a bounded 404 mapping correction. Separate synthetic identities were onboarded/enrolled/appointed through current services; issuing entity was created only through proposal/decision. Covered authority denial, immutable inventory/pagination, foreign/self/content rejection, proposal and decision retries/conflicts, exactly one entity/audit, existing-entity rejection, rejection state, revocation and no-write projections. Tests are backend/API evidence, not browser operation. Both newly owned PostgreSQL/tmpfs runs and public test registries were removed after ownership checks. 122 unchanged migrations only prepared these empty fixtures. Rate admission mocked; no Redis/provider transport claim. Detailed backend record: docs/security/Issuing_Entity_Setup_UI.md.

Focused ESLint passed, exit 0, for adapter/workspace/page/sidebar/test; the installed CommonJS loader has an explicit no-require-imports exception. Final frontend node node_modules/typescript/bin/tsc --noEmit --incremental false and backend no-emit with 4GiB Node heap passed (exit 0, no diagnostics). Installed Node --test tests/entity-setup.test.cjs initially passed 11/12; only the corrected normalized-retry assertion reran and passed. Counts are distinct cases, not repetitions. Existing DOM-04 concurrency/rollback and session/socket, finance/logistics and other client evidence reused unchanged; no broad suites or database campaign beyond new query/HTTP cases.

## Visual and release limits

Visual verification pending: no new screenshots or rendered desktop/tablet/390px/100%/200% zoom/focus checks. Computer Use was not retried; no browser tool was installed. Source uses corrected shared admin min-width/wrapping, available-width stacking and bounded keyboard-focusable receipts, but source does not prove absence of rendered overlap/clipping. The user will inspect visuals later. Rendering availability is not an implementation gate for this expressly authorized batch.

Preserved all prior blocked cleanup directories and backend dist changes. No real keys/appointments/grants/configuration, production provisioning, push or deployment. Real company intent, registry/secure credential handoff, statutory invoice validation and infrastructure remain external gates. Financial business screens, cash supplementation and client/device verification remain later work.

Next finite task, not started: cash supplemental administration discovery/UI using existing owner-accepted cash delegation and immutable independent approval contracts, without expanding base driver/warehouse roles or capabilities.
