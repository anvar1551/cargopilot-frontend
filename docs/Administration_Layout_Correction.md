# Administration layout correction — source evidence

2026-10-08. Frontend baseline: 35d767e90fbd5002121251eac61c0c5af7222f5b.
Backend remains 798cc26916c5d1ada441f54c859007c6b63635c8, unchanged.

## Finding and bounded correction

The reported financial-access overlap/overflow has not been reproduced in a browser in this correction. Source review confirms automatic minimum-content sizing in fieldsets/flex children, viewport-triggered columns despite narrower cards, fixed-height non-wrapping buttons, unbounded receipt blocks, and unbounded shared user name/email content. These are concrete sizing risks; source evidence alone cannot establish the exact visual outcome.

PageShell now permits shrinking within its parent. Financial access, operational staff, driver administration and warehouses opt into scoped administration rules: available-width adaptive grids, shrinkable content, long-text wrapping and wrapping action groups/buttons. Warehouse full-width fields span the actual grid without creating implicit columns. Operational directory tables deliberately scroll within a bounded, keyboard-focusable region; structured receipts wrap at readable size inside bounded focusable scroll regions. Essential content remains accessible; no overflow-hidden masking or feature removal was introduced.

The ERP topbar can reflow and remains in normal flow below its desktop breakpoint or in short windows. The shared user menu wraps names/email without truncating its details and bounds its scrollable menu to the viewport. Existing reduced-motion rules remain intact. Authentication, requests, permissions, immutable operation intents, retries, grants, handlers and business response contracts are unchanged.

Changed source: app/globals.css; components/layout/PageShell.tsx; components/layout/AppTopbar.tsx; components/user/UserMenu.tsx; components/workspace/FinancialAccessWorkspace.tsx; OperationalStaffWorkspace.tsx; DriverAdministrationWorkspace.tsx; WarehouseWorkspace.tsx.

## Validation and limits

- Focused ESLint passed (exit 0) for the seven changed TSX files using installed Node and node_modules/eslint/bin/eslint.js.
- Installed PostCSS with @tailwindcss/postcss compiled app/globals.css in memory, no warnings and exit 0; no generated output written. This verifies CSS parsing/generation, not layout rendering.
- Final TypeScript command: installed Node node_modules/typescript/bin/tsc --noEmit --incremental false. Passed, exit 0, no diagnostics.
- Business/backend/database evidence from Financial_Access_UI.md and the preceding staff/driver/warehouse reports is reused because exercised behavior, dependencies and schema are unchanged. No business tests, database suites, builds or services were run for CSS.
- Visual verification remains pending. No new before/after screenshots were captured. Desktop, tablet, 390px mobile, 100%/200% zoom, actual overlap/clipping, keyboard focus and cross-browser behavior are unverified. Earlier financial screenshots and a document-width check do not certify this correction.

Computer Use was previously rejected because the current browser URL could not be determined confidently for policy enforcement. Per the user's source-only direction, it was not retried or bypassed; no browser tooling was installed and no preview server was started. All blocked cleanup directories remain untouched.

Before the next UI feature batch is committed, actual visual inspection is an acceptance requirement. Inspect long names/emails/IDs, permission labels, proposal details, loading/error states, pending/confirmed receipts and all actions at the viewports/zoom levels above. This explicit source-only correction is not visual acceptance of those states.
