# Client membership selection and session containment

Baseline frontend: 24c6d23ba813a3a0439225d2eb6c698ce946db89. Backend contract/checkpoint: e6338dcbbc6726ae7210044e00d06b43fba5c3cc. Client changes remain uncommitted for review.

## Plan, authority and compatibility

1. Use the existing POST /api/auth/login contract. Credential verification happens on the backend before HTTP 409 code MEMBERSHIP_SELECTION_REQUIRED with memberships containing companyMembershipId, companyName and tenantName. Render only those projected choices; resubmit email/password plus companyMembershipId. Do not choose the first membership. One eligible membership still logs in directly.
2. Validate success token/refreshToken/user and preserve id, tenantId, tenantMembershipId, companyId, companyMembershipId and compatibility membershipId. JWT decoding is a local consistency check only; signatures/current eligibility remain server authority.
3. Persist one complete bound session envelope; fence async work with a session generation. Refresh accepts only the exact existing identity tuple, using the rotated token, refreshToken and user. A mismatch ends that session. Old responses cannot restore it or clear a newer login.
4. Gate protected workspaces and transport/background work on a complete bound session. Clear query state and remount business views on logout/new login. Partition business caches and fence late HTTP/realtime responses. Preserve pending cash intent storage, original context, operation IDs, payload and custody event; suppress retries under another selected membership.

No backend endpoints, schema or dependencies changed. Context switching requires logout and fresh credential verification. No permissive legacy-session conversion: even previously bound sessions stored under the old separate keys require fresh login. Credentials stay transient in login-screen state through selection, clear on completion/failure and disappear on unmount; no password persistence/logging. Login failures expose sanitized messages rather than Axios configs. Concurrent screen submissions are blocked by a synchronous ref. Password changes clear previous eligible choices.

Rollback must retain these boundaries or disable the affected client; do not reinstate global caches, mixed token/user storage or unbound queue replay.

## Implemented boundaries

The complete session uses cp_auth_session_v1 in localStorage. A fresh cryptographic nonce plus local generation fences protected Axios requests/responses and refresh. Refresh keeps the same nonce/context. Storage events invalidate query caches across tabs; provider keys remount views. Dashboard children wait for session validation/refresh before mounting. Protected SSE checks context before connecting, partitions its cursor by the full identity, aborts on session changes and discards late frames. Order filter presets are partitioned by the captured selected context; legacy unowned presets are not adopted. Language/UI appearance settings remain non-business device preferences. Cryptographic browser UUID support is required; unsupported/storage-failing environments fail login closed.

Cash pending records are intentionally retained rather than erased on logout. Their identity includes both tenant and selected company membership. A user must freshly log into the original authorized context and explicitly reconcile/retry an ambiguous action; refresh/UI state cannot replace its payload or retry IDs. Existing driver handoff/settlement/web-cash restrictions and payment limitations remain.

A response fence does not cancel an already accepted backend mutation or establish immediate server-side revocation. Logout here clears client state; server refresh-family/revocation races and already-connected server delivery timing remain separate blockers. Refresh updates stored permissions, but this slice does not certify instantaneous refresh of every permission-dependent mounted widget.

## Focused evidence

node --test tests/membership-session.test.cjs: 15 passed in the full initial focused run. Added SSE/restart checks: two selected tests passed; added identity-field/context matrix: one selected test passed. There is passing evidence for 17 distinct session cases; a final full 17-case run was not repeated.

Both clients: node --test --test-name-pattern="actual HTTP interceptor|selected identity" tests/cash-contract.test.cjs: two affected cases passed. Other unchanged cash evidence is reused. node node_modules/typescript/bin/tsc --noEmit --incremental false passed during development; final checks are recorded below. Focused ESLint initially passed with no errors (27 warnings); relevant introduced unused/dependency warnings were corrected without broad cleanup.

Tests execute the actual login helper, auth persistence, Axios interceptors and selected cache/realtime modules using mocked storage/network/native APIs. Restart tests reload the module against persisted mocked storage. No browser session, real SecureStore/device restart, live HTTP/SSE/Socket.IO transport or deployed infrastructure verification was performed. UI rendering/accessibility and translated membership labels still need browser/device acceptance. No database, Redis, AWS or provider connections were made for this client slice. The previous backend PostgreSQL/mocked/type-check evidence was reused for its unchanged checkpoint.

## Exact changed-file scope at documentation creation

```text
M app/(auth)/login/page.tsx
 M app/dashboard/manager/orders/page.tsx
 M app/providers.tsx
 M components/layout/DashboardShell.tsx
 M lib/api.ts
 M lib/auth.ts
 M lib/cash-intent.ts
 M lib/sse.ts
 M tests/cash-contract.test.cjs
?? lib/session-contract.ts
?? tests/membership-session.test.cjs
?? docs/Membership_Selection.md (this report)
```

## Remaining gates

Provisioned active tenant/company bridges are required; tenant-null/legacy access is not restored. Membership eligibility and object authorization remain server-owned. Proof PNG/codec compatibility and durable queue migration, driver unsupported cash operations, payment limitations, backend refresh-family recovery/revocation timing, complete tenant cutover/repository scoping, Redis lifecycle/backpressure, provider recovery, RLS and previous release blockers remain open. These client unit checks do not establish production readiness.

## Final offline checks

Final no-emit type checking passed after all functional corrections. Focused ESLint passed with zero errors. The final auth/filter-preset rerun retained one explicit-any warning; the final DashboardShell guard check passed. Unchanged lint evidence for other affected files is reused. Tracked/untracked slice whitespace and credential-pattern review passed; nothing in either client was staged or committed. Existing backend evidence was reused without rerunning its tests.
