# Finite pricing UI correction

Baselines: frontend a2471e8e3d2626e3618ea497bf4f97bc1c2f9cfd, backend 547ce1bb2f1a8b11fdd7857fae5650688356b6b0.

Confirmed from source: editor values outlive selected tariff changes; update combines those values with the currently selected ID. Awaited detail loads have no selection/request fence. Required JSON textareas exist for rates/transit and policy collections.

1. Add a component-owned editor identity/request fence. Selection invalidates editable identity; new authoring is explicit. Loads publish only for the latest live selected context/request. Update builds its target from the loaded identity and rechecks it at submission. Exact target name/ID shown for update/delete. No changes to stored intents or receipt-less retry containment.
2. Structured bounded row/list controls for all supported rate, transit, route, included service, fee, discount and eligible-state fields. Explicit empty choices only where supported. Exact policy money stays text; numeric tariff fields convert only at existing API normalization. No monetary defaults, new policy, backend contract/schema changes or scope expansion. Exact JSON remains read-only inspection.
3. Focused pure editor state/component contract and payload tests; affected existing intent tests; existing actual HTTP/PostgreSQL setup and draft-edit cases only, because submission target wiring changes. Final no-emit and focused lint. No browser attempt; visual pending. Reuse approval/calculation/concurrency/cash evidence. Preserve dist and blocked cleanup.

Rollout/rollback: frontend-only correction against the unchanged backend. Never restore unsafe retargeting or automatically replay receipt-less drafts. Review and commit this finite slice locally, then stop before cash screens.
