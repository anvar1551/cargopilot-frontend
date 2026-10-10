# Cash supplemental administration workspace

Baselines backend 8dec8543f5216cede13e0ab63121700692935bfb / frontend 51bee34eca3a66a9d20ced6ce79fa363de598a4f. Finite administration batch; no business cash screen, schema, policy or dependency change.

## Implemented contracts

/dashboard/manager/cash-access has separate proposer/checker views. Permission-aware navigation is not delegation authority: current independently owner-appointed cash-delegation.v1 and selected company context must validate on every API. Ordinary administrator, financial/operational/driver delegation cannot substitute. Missing owned active entity or accepted authority is explained, never provisioned automatically.

| Action | Actual API / client requirement |
| --- | --- |
| Accepted ceiling and selectors | GET /api/auth/company-cash-capabilities?view=ceiling, recipients, proposals or grants&kind=proposer or checker&limit&cursor. Bounded 1..50; UI requests 20. No-store. Current owned entity, exact approved profiles/kinds, named warehouse ceilings and eligible existing recipients. Empty filtered pages can have a next cursor. |
| Proposal / replacement | POST /api/auth/company-cash-capabilities/proposals; original operationId, selected membershipId/legalEntityId, one profileRevisions entry, nonempty warehouseIds/kinds, expectedAcceptanceId and reason. Replacement grants nothing before independent acceptance. |
| Independent acceptance | POST /api/auth/company-cash-capabilities/accept; original operationId/proposalId/fingerprint/reason. Different User from proposer and recipient. Exact local inspected snapshot verifies the response; it is not sent as authority. |
| Controlled revocation | POST /api/auth/company-cash-capabilities/revoke; original operationId/membershipId/legalEntityId/expectedAcceptanceId/reason. Accepted proposer or checker ceiling must cover the entire removal. Unrelated grants and base roles/scopes remain unchanged. |

Exactly local-driver-cash.v1 and warehouse-cash.v1 grant cash.custody.read, cash.collect, cash.handoff; cash-settlement-checker.v1 grants cash.custody.read, cash.settle. No broad shipment, company/warehouse scope, driver type, finance, accounting, further delegation or override is added. Local eligibility is membership-specific and preserves exact base role/zero scopes. Warehouse eligibility requires the current approved base profile and explicit selected warehouse scopes. All returned selections are snapshots; writes revalidate current authority, recipient and prior grant atomically.

Immutable inspection shows recipient, membership, entity, profile, cash kinds, named warehouses/IDs, previous acceptance, fingerprint, proposer, reason and accepted/pending state. Managed grants are separate from unrelated roles. Revoked authority, missing prerequisites, stale prior grant, non-independent proposals and uncertain receipts have distinct guidance. Existing cash domain codes are preserved by the backend mapper; operational 409 responses are not all presented as conflicting request identity.

## Durable non-secret intent contract

cp_cash_admin_v1 keys include API origin, full selected identity/context and action kind. Web Locks and storage read-back precede sending. Original normalized ID/content/prior acceptance/reason and immutable inspected acceptance snapshot survive reload and explicit matching retries. Fresh selectors cannot rewrite pending content. No automatic replay; unconfirmed intents cannot be finished or replaced. Only confirmed local actions can be finished. Auth epoch/context guards reject late read/mutation responses and foreign saved intents. Receipts never confer current access. No invitation tokens, passwords or owner keys are handled in this screen.

## Verification and limits

Visual verification pending: no new screenshots or rendered desktop/tablet/mobile/zoom/focus inspection. Corrected shared min-width, available-space grids, wrapping and keyboard-focusable bounded receipt regions are reused; source checks do not prove absence of visual overlap. Computer Use was not retried and no rendering tools/dependencies were installed. Owner visual review remains necessary.

No real grants, prerequisites, owner signing, collection/transfer/settlement, merchant COD monetary basis, accounting, FX or suspended-holder recovery was enabled. Selecting a governance kind does not create a monetary obligation: DOM-06 service charges require exact accepted pricing/payer/CASH instructions; merchant COD is still blocked. Existing roles/scopes and other-company memberships are preserved. Native clients and real transport/device verification remain outside this batch.

Roll out backend additive discovery/error-code preservation before this frontend. No migration required. Removing the UI must preserve accepted grant history and local pending intents. Prior dist changes and all blocked cleanup directories remain untouched.

## Executed and reused evidence

11 distinct client cases passed across initial 10 passes and one corrected normalized-retry assertion rerun. The corrected assertion compares immutable operation ID/payload rather than local receipt metadata. Exact three profiles/allowlists, resource/kind bounds, durable restart/retry/conflict, storage write/read-back failures, lock denial, context/late suppression, uncertain outcomes, exact acceptance/revocation snapshots, safe/stale reads and operational-vs-identity rejection are covered. Installed Node --test tests/cash-administration.test.cjs; affected rerun --test-name-pattern="normalized stable retries". API/storage/Web Locks are mocked; no actual browser persistence claim.

Backend actual HTTP-injection/PostgreSQL: 7 new administration cases and 2 affected existing concurrency/rollback cases, 9 distinct passing cases across focused runs. Actual synthetic current services supplied prerequisites and exercised all three supplements, independent acceptance, managed reads, replacement/revocation, no-write rejection/projections and unchanged base roles/scopes. Initial test syntax/default heap/omitted historical fixture timeout failures were corrected; an incorrect cursor expectation retained the 403 authority-denial assertion and added the cursor check in an authorized view. The final discovery rerun passed 3 cases (1 setup repeated, 2 new passes), not three extra distinct cases. Details, exact commands, all five verified disposable cleanups and reused evidence are recorded in backend docs/security/Cash_Supplemental_UI.md. 122 unchanged migrations prepared empty fixtures, not a broad migration recertification.

Final frontend no-emit (installed Node node_modules/typescript/bin/tsc --noEmit --incremental false) and focused ESLint (adapter/workspace/page/sidebar/new test) passed, exit 0. Final backend no-emit with bounded 6 GiB Node heap passed, exit 0; initial default heap exhausted. One JSX apostrophe lint error was corrected before final lint. No build/dist/client generation/dependency change. Unchanged cash execution/DOM-06/logistics, concurrency not affected by extraction, and real HTTP/socket revocation evidence reused; no new socket/storage/provider/native verification.

Next proposed finite batch, not started: existing approved pricing/payer/CASH instruction workflow integration, then separately restricted service-charge action screens. This milestone is cash access administration only. Visual verification and screenshots remain pending.
