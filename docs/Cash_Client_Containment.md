# Cash client containment

Backend authority: checkpoint c648e430ef54cfc2f96bbe82fc56681b3085ab92, additive cash receipts migration required before enabling these actions. Frontend baseline c3f7f3d66a43b11a0a89131a7fa93e635b662eab. No local frontend AGENTS.md was present; the backend security architecture defines the reviewed contract.

## Current client behavior

- `lib/cash-intent.ts` implements one bounded persisted pending intent, tied to user, tenant, tenant membership, company and selected company membership. `lib/cash.ts` uses localStorage plus an exclusive Web Lock, up to 40 items. Storage or lock failure prevents sending. Unsupported browsers are contained.
- New requests create UUIDs once, omit money/paid/ownership authority and persist the complete path/body before POST. Handoff/settlement obtain the current held collection's latest event ID from the authorized order detail snapshot. Manual retries use the saved body and event, without another snapshot lookup. No startup replay occurs.
- An uncertain timeout/network/server response retains the intent. Repeating the unchanged action offers a manual retry. Changing inputs or context blocks it. A different context cannot clear/replay the saved intent through this API. Return to the original authorized context for resolution; no generic reset is provided.
- A definite first-attempt 4xx rejection (except 408/429) blocks the intent. Partial bulk responses remain unresolved because item error codes do not establish non-commit. Explicit dismissal clears it without sending. Reload and review before a genuinely new action. The bulk response lacks per-item status/retry classification; there is no automatic bulk recovery.
- `lib/api.ts` checks cash context again and verifies local token-claim/context consistency before sending and excludes cash from automatic refresh/replay. Authentication failure requires fresh login. It cannot recall an already dispatched request after logout/context switching; the backend authenticates and authorizes the captured request independently.
- `lib/auth.ts` retains all bridge fields from server login/refresh responses. Legacy cached users without them cannot execute cash actions. Multi-membership selection UI remains unsupported.
- `lib/orders.ts` exposes minimized cash receipt response types, distinct from full Order. Decimal strings remain strings; receipt snapshots are not merged into complete order cache entries. Existing legacy Float-based queue summaries are informational, not monetary authority. No new client financial calculation is introduced.
- Order details, warehouse and manager consumers refresh authoritative queries after confirmed/partial results. Settlement requires a separately authorized checker who did not collect or last handle the cash. Warehouse acceptance cannot impersonate a driver; the driver must initiate handoff. Current driver consumer lacks handoff support, so that workflow remains blocked there.
- UI request amounts were removed. Existing proof, invoice checkout and membership-selection limitations are unchanged.

## Changed files

`lib/cash-intent.ts`, `lib/cash.ts`, `lib/api.ts`, `lib/auth.ts`, `lib/orders.ts`, `app/dashboard/warehouse/page.tsx`, `components/orders/OrderDetailsView.tsx`, `components/manager/analytics/ManagerAnalyticsV2Page.tsx`, `tests/cash-contract.test.cjs`, this document.

## Evidence and remaining limits

`node --test tests/cash-contract.test.cjs`: 18 distinct passing client/mocked cases: initial 17-case run, followed by 2 affected interceptor/token cases passing after the token-pairing correction; unchanged cases reused. Includes adapter and interceptor execution, saved IDs/payload/event after reload, stale/permission errors, partial bulk failure, context changes, storage failure and exact decimal strings. Reload uses mocked storage and a new module instance; real browser persistence/crash recovery/transport has not been exercised.

`node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed. No build output, dependency changes or services. Backend evidence is reused, not reproduced by these tests. Security does not rely on client storage integrity; server receipts/current authorization remain authority. Device loss/storage deletion loses the retry journal; a server receipt lookup/reconciliation UI is deferred. There is no claim of exactly-once transport, complete tenant isolation, immediate revocation or production readiness.

The token-claim check is local pairing only, not signature verification. It handles non-atomic token/user persistence during login switching and rejects refresh-purpose or mismatched tokens. The server retains signature/current-membership authority. Missing native base64 decoding also fails closed.

Affected-file ESLint: zero errors, 28 warnings (existing UI/API warnings plus permissive adapter types); no full lint audit.

Checkpoint correction: a 4xx on a retry of a previously unresolved intent never makes the original operation clearable. Its earlier outcome remains uncertain and must be reconciled. Concurrent adapter submissions were exercised with mocked browser locks/native storage and produced one request.

Final checkpoint validation after the ambiguity correction: 20 cash-contract tests passed; no-emit type checking passed. Prior unaffected lint evidence reused.

Final partial-bulk correction: partial responses retain the unresolved original IDs/body, including after a timeout. No clear/reset is offered for these outcomes. Only an explicit unchanged retry or future receipt reconciliation can resolve them; UI refresh cannot replace them. Two affected partial-result tests passed; unchanged evidence reused.
