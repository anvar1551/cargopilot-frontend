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

Pending implementation and focused validation. This section will record executed
evidence and limitations before checkpointing.
