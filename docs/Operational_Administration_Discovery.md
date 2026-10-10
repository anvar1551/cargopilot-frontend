# Operational administration discovery — current checkpoint

Baselines: frontend fc7b3590ffd581ea27e0087e8d0551255411dd38;
backend ea985c879d7a7290df79cc29a3941830102ec9cd. Driver unchanged.

Staff workspace now uses accepted operational authority, named owned warehouse
resources, original-inviter invitation inventory/status and current manageable
grant projections. Select a pending invitation to cancel, select allowed warehouses
by name, and inspect current managed profile/scope before replacement/revocation.
Ordinary member-directory roles do not establish grant authority. A revoked grant's
last scope is explicitly historical. Current discovery errors disable actions;
mutations still revalidate all authority, target and removed/replacement ceilings.

The additive four GET /api/auth contracts are documented in backend
Operational_Administration_Discovery.md. Pages are bounded and selected-context
cursors cannot be reused across collections/memberships. A filtered empty grant
page may still have a next page. Frontend strictly projects responses, sends noReplay
reads and rejects late responses after context/epoch changes. Backend-first rollout
is required. No schema, new permissions or ceilings, profile expansion or token
regeneration. Prior persisted non-secret intents are restored without changing their
ID/content. Confirmed original retries remain available after reload without
reselecting a target. Discovery cannot overwrite a pending intent.

## Executed versus reused evidence

- node --test tests/operational-discovery.test.cjs: 5 distinct passing cases.
  Secret projection, bounds/profile rejection, missing/foreign context, deferred
  old-context response suppression and managed-grant/cursor contracts.
- node node_modules/typescript/bin/tsc --noEmit --incremental false: passed.
- node node_modules/eslint/bin/eslint.js
  components/workspace/OperationalStaffWorkspace.tsx lib/operational-discovery.ts:
  passed. Final restored-intent UI source was included in type/lint validation.
- Backend: 9 mocked read cases and 10 distinct actual HTTP/PostgreSQL cases passed.
  One exclusively owned empty PostgreSQL instance prepared using 122 unchanged
  migrations. No new database constraint or mutation concurrency behavior.
- Real synthetic browser/backend journey: select and cancel persisted invitation;
  issue warehouse invitation using named North resource and clear transient token;
  inspect South-scoped managed target, replace with North, reload and retry original
  operation, then revoke. Database confirms four unique mutation operation/audit IDs,
  retry no duplicate and revoked target has zero scopes. Revoked inviter authority
  fixture state prevents subsequent discovery/mutation UI actions.
- Desktop and 390x844 mobile inspected; document width 390, no horizontal overflow.
  Screenshots outside repository: inventory-desktop.jpg, inventory-mobile.jpg,
  revoked-authority-desktop.jpg in the operational-discovery visualization directory.
- Reused unchanged 20 prior B3 client intent/acceptance cases and backend
  invitation/grant concurrency, rollback, identity binding and HTTP/socket revocation
  evidence. B1/B2 and logistics/finance suites were not rerun.

## Evidence limits, cleanup and handoff

No real invitations or email sent. Browser tokens remain transient; no tokens or
passwords in persisted mutation intents/screenshots. Lost issuance secret remains
unrecoverable; unconfirmed/rejected intents cannot be blindly abandoned/regenerated.
Inventory is current metadata, not proof every local uncertain receipt confirmed.
Authority checks are fresh per read/mutation; snapshots are not future authorization.
Storage/providers/Redis boundaries mocked; no new real Socket.IO, native-device,
production-scale query or deployed infrastructure verification.

Owned PostgreSQL container cp-verification-ac50b095df68 and exclusively owned tmpfs
removed with verified labels/name/storage. Both APIs and frontend listener stopped.
Automatic approval review rejected cleanup of
C:\Users\Anvar\AppData\Local\Temp\cp-frontend-discovery-owned-MDFV8l as blocked by
policy. Leave for manual cleanup; no retry/bypass. All earlier blocked directories,
Python runtime, dist and unrelated work preserved.

Exact next task after review: driver invitation and managed local/linehaul membership
UI under approved ceilings and active-work replacement blockers. Not started.
