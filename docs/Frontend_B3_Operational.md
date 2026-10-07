# Current follow-up

Invitation inventory/status, named accepted-ceiling resources and manageable-grant discovery are now implemented. See [Operational_Administration_Discovery.md](Operational_Administration_Discovery.md). The original milestone evidence and missing-contract statements below are historical; lost-secret regeneration and uncertain-intent abandonment remain unavailable.

# B3 operational invitations and managed grants

## Bounded execution plan

Baselines: frontend e9daeb0e0567d2d0cd62d447777880d60d1f6f16,
backend ea985c879d7a7290df79cc29a3941830102ec9cd.

1. Replace the Users arbitrary creation, role, scope and global deletion controls
   with the existing company invitation/cancellation and managed operational grant
   endpoints. Preserve scoped member search and pagination.
2. Offer only operational-clerk.v1, operational-dispatcher.v1 and
   operational-warehouse.v1. Warehouse scopes use explicit UUIDs (maximum 20).
   Current accepted authority, ownership and removed/replacement ceilings are
   checked by the backend; permission/role labels never establish delegation.
3. Persist normalized, secret-free intents before sending, verify storage,
   serialize tabs, retain operation IDs across uncertain outcomes and suppress
   late/context-changed responses. Invitation tokens exist only in component
   memory. Confirmed creation retries return metadata without recovering tokens.
4. Add a separate recipient acceptance page. New users supply transient
   name/password; existing users authenticate and omit credentials. Acceptance
   issues no session. An ambiguous new-user acceptance requires authenticated
   confirmation with the original operation ID/token; it must not reset passwords
   or create a second intent. Never put tokens in URLs or persistent storage.
5. Run focused client contracts and one owned synthetic PostgreSQL/browser journey
   through invitation, acceptance, selected login, customer/order access,
   replacement and revocation. Reuse unchanged backend concurrency/revocation
   evidence. No real invitations, owner browser signer or new backend policy.

## Confirmed contract gaps / compatibility

There is no invitation inventory/status API, no managed-grant detail API and no
delegation-ceiling/warehouse picker API. GET /api/auth supplies scoped current
members, roles and scopes, but role display is not proof of managed authority.
Cancellation uses a known invitation ID; grant requests use explicit membership
IDs and warehouse IDs. UI results are labelled local receipts, not live inventory.
The backend rejects unowned, unmanaged, self or out-of-ceiling targets.

Invitation creation returns a token once; matching retries return only invitation
ID/expiry. Lost token issuance stays unrecoverable here. No automatic new invite,
secret regeneration, email delivery or abandonment of uncertain intents. Cancellation
may be requested by the original inviter using the known ID. Without that ID an
uncertain issuance needs a future authenticated receipt/status contract.

Grant replacement/revocation invalidates the target's selected-context sessions;
fresh login is required. Other-company memberships and unrelated grants remain
protected by the backend. Driver, warehouse provisioning, financial/cash/setup
delegation are later B3 milestones. No schemas/migrations changed in this milestone.

Implementation checkpoint: 27ef1ed6452d4eab3cd417a0a65e451a18bc36fc.

## Validation and checkpoint

Implemented: Users now exposes only operational-clerk.v1,
operational-dispatcher.v1 and operational-warehouse.v1, known-ID cancellation,
scoped member search and managed replacement/revocation. The legacy creation
control links to this workflow. /invitations/accept handles new identities with
transient credentials and authenticated existing identities without new
credentials. Acceptance never signs in or switches the selected company.

Strict normalized intents bind API origin, identity/tenant/selected membership
context and operation ID. Persistence/read-back precede sending; Web Locks
serialize submissions, retries and confirmed-receipt removal. Unsupported
browsers fail closed. No automatic HTTP replay. Late responses cannot confirm
another context. Durable intents exclude tokens/passwords; acceptance retains
only a non-reusable token digest and non-secret metadata. Transient one-time
copy/handoff is deliberate; no email or OS clipboard-history erasure is claimed.

Unconfirmed/rejected intents remain frozen, with one slot per kind/context.
Only confirmed receipts can be explicitly finished. New-user credentials cannot
be resent after a persisted attempt. Authenticated confirmation uses the original
operation ID/token without resetting credentials. If no account was created,
the absent acceptance-status contract prevents automatic recovery. Lost issuance
secrets cannot be recovered from matching creation retries. Local receipts and
displayed roles are not current delegation authority. Manual warehouse UUIDs
(maximum 20) are checked against current authoritative ownership and ceilings.

### Executed evidence

- `node --test tests/operational-staff.test.cjs`: **20 distinct cases passed**.
  Strict profiles/allowlists, scope normalization, storage failure/read-back,
  restart/stable IDs, conflicts, cross-tab locks, safe errors, late/context-changed
  responses, exact routes, /api base-prefix handling, secret exclusion,
  authenticated identity checks, credential replay suppression and confirmed
  receipt removal versus a competing retry. Earlier reruns are not added.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: exit 0.
- Focused ESLint on all seven implemented source files: exit 0, no warnings.
  Final client tests/type/lint were rerun after correcting receipt removal to use
  the submission lock and late-context guards. No dependencies changed.
- One newly owned PostgreSQL 16 instance applied the unchanged **122 migrations**.
  **12 distinct actual HTTP/PostgreSQL cases** passed: matching invitation retry
  without another secret/row; conflict/no writes; warehouse-ceiling rejection;
  forbidden profile; unauthenticated existing-identity adoption rejection; wrong
  authenticated identity rejection; verified existing-user binding preserving
  the other-company membership; matching acceptance; consumed-token rejection;
  fresh dispatcher customer denial/order access; prior access/refresh revocation
  with disabled grant, removed roles/scopes and no live sessions; accepted owned
  warehouse profile with its exact warehouse scope and no company scope.
  Controlled synthetic owner authority and one warehouse were prerequisites,
  not public warehouse provisioning. No owner signer/key is exposed in the browser.
- Connected actual browser/backend journey: invite/cancel; distinct clerk invite;
  new acceptance; fresh selected login; customer and linked normal order creation;
  dispatcher replacement; customer permission-denied screen; managed revocation
  and refreshed member directory. Authenticated confirmation of the original
  acceptance after revocation returned its original ID without reinstating grants.
  Final guarded database reads proved one linked order with matching tenant/company,
  one membership and disabled grant. The final inspection initially used identity
  customerId instead of master customerEntityId; correcting the schema-based query
  passed without application changes.
- Desktop 1440x900/mobile 390x844 inspection: stacked forms and locally scrolling
  member table, no document horizontal overflow. Screenshots outside the repo:
  operational-staff-desktop.jpg, operational-staff-mobile.jpg,
  replacement-denied-desktop.jpg, acceptance-confirmed-desktop.jpg and
  acceptance-mobile.jpg in the frontend-b3-operational visualization directory.

These are HTTP/database and browser checks, not production/native-device evidence.
Redis admission, storage, labels/carrier and best-effort pricing component effects
were mocked. No financial acceptance, live provider or email transport exercised.
Existing IAM, cancellation/removed-ceiling concurrency/rollback, foreign ownership
and HTTP/socket revocation evidence was reused unchanged. No new real Socket.IO
campaign. Final receipt-removal lock correction has unit/type/lint evidence; the
browser journey predates this metadata-only correction, with unchanged business
request/authorization behavior. No database rerun was needed.

### Cleanup, compatibility and next task

Run e76e13fcc96b: owned API stopped and test registry cleaned;
cp-verification-e76e13fcc96b removed after name/label/storage verification,
including its exclusively owned tmpfs. Test listeners 4319/3219 are stopped.
Automatic approval review rejected removal of
C:\Users\Anvar\AppData\Local\Temp\cp-frontend-b3-owned-VZXO8v
as blocked by policy; leave this source/output copy and dependency junction for
manual cleanup. No retry/bypass. Earlier blocked directories and Python untouched.

Backend remains ea985c879d7a7290df79cc29a3941830102ec9cd with existing dist changes
only. No backend endpoint/schema/permission changes. B1/B2, driver and financial
containment unchanged. Real email delivery is unavailable; secure private delivery
is the inviter's responsibility. Inventory/status, managed detail and ceiling
lookup remain missing contracts, not fabricated screens or successful recovery.

Exact next bounded milestone, not started: inspect Drivers and current driver
invitation/grant contracts, implement managed local/linehaul membership UI with
approved ceiling, active-work replacement blockers and immutable context-bound
intents. No shared User.driverType mutation or native driver implementation.
Warehouse creation, financial/cash delegation and entity setup remain later B3.
