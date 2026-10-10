# Isolated demo acceptance corrections — 2026-10-09

## Scope and result

Application baseline: frontend acfbb24256fc9ce097a2b0d4f4226e04e2967b90; backend 2243f519b179437f766baa0c626e159a133ea8a2 (unchanged). This is a finite correction of the six findings from “Isolated demo acceptance — 2026-10-08”, not another security audit.

| Finding | Correction / status |
| --- | --- |
| Demo parcel helper | PASS through supported services; separate demo-only file, not application source. Reads orderStatus and custody.phase, retains original context-bound requests, resumes recorded pickup/offer/intake without SQL or fabricated proof. |
| False Prepaid inference | PASS source/unit and actual overview: absent authoritative method evidence displays Unknown. A supported method label explicitly says payment status unknown. Invoice URL, legacy paid mirrors, collection and settlement never establish invoice payment. No additional privileged reads or inferred timing. |
| Empty pricing history refresh | PASS focused regression: history enablement and explicit refetch use the same selected-target/permission predicate. Browser recheck NOT TESTED after control stalled. |
| Cash/billing translations | PASS all three locale tests and readable fallback wiring. Service-charge cash label observed in browser. Full localized menu visual check NOT TESTED. |
| Post-login destination | PASS focused cases and browser: warehouse actor with stale /dashboard/driver next reached /dashboard/warehouse. Registered permitted deep links retain query/fragment; foreign context, unknown/unauthorized paths and malformed destinations fall home. This navigation hint never grants server access. |
| Mobile component table | PASS source/accessibility regression: labelled keyboard-scrollable bounded container, explicit column headers, minimum table width, intact exact monetary values and wrapping descriptions. Rendered mobile verification remains pending; no rendered/cross-browser claim. |

## Executed evidence

- `node --test tests/acceptance-corrections.test.cjs tests/membership-session.test.cjs`: 28 passing cases (8 new correction cases, 20 affected session cases), zero failures. Static wiring assertions are not rendered component tests.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- Focused ESLint on the changed application/helper/test files: zero errors; two existing unused-variable warnings in manager overview. No emitting build.
- Existing isolated demo, actual services/HTTP/PostgreSQL: recorded driver-held collection -> pickup/status -> pickup offer -> warehouse intake; helper matching resume; cash offer and matching retry; exact-recipient acceptance and matching retry; independent settlement and matching retry. Original IDs retained.
- Two distinct wrong-actor HTTP cases: driver acceptance and holder settlement both 403, with unchanged business snapshots.
- Final read-only PostgreSQL assertions: exact 100.0000 UZS source unchanged; four receipts (collect/offer/accept/settle), one offer, three custody operations (collect/handoff/settle), one settlement event, no invoices or finance sources created, zero entity journals.
- Browser observed: offer retains driver holder, reload/acceptance changes holder to named warehouse recipient, historical receipts survive reload, wrong-workspace login falls home, overview shows Unknown. Screenshots were captured and inspected for offer/acceptance. Browser control later stalled; settlement completed through HTTP, not browser.

Reused unchanged evidence: original collection retry, pricing/editor/business acceptance; backend authorization, concurrency, rollback and Socket.IO tests. No broad suites, migration chain, database recreation, providers, storage writes or new grants. No backend source/schema/API changes.

## Demo-only changes and limitations

The helper, persistent helper intents and HTTP/read-only evidence live only in the existing owned CargoPilotDemo directory. The stopped owned PostgreSQL container was restarted after label/volume verification; its reassigned loopback port was reflected only in demo metadata/private runtime configuration and the guarded backend was restarted. No existing environment file or other service was adopted. The demo and database remain available, not cleaned up.

The helper is bounded to the original driver-held service-charge handover. After settlement it must reject that prerequisite rather than manufacture another journey. Its intent binding is verified, writes use exclusive locking/atomic replacement/read-back, and requests preserve their original identity. No SQL mutation, permission expansion or fabricated custody/proof.

The settlement browser click timed out. Database reads showed no settlement and a fresh workspace displayed no pending settlement intent; the explicit HTTP test then persisted its own immutable request before execution and retried that exact request. Browser settlement confirmation and corrected desktop/mobile pricing table inspection remain unverified. Existing nested html/body hydration diagnostics were observed and left outside this correction scope.

Exact cash history remains distinct from invoice-paid status and executable accounting. Merchant COD, refunds, FX, suspended-holder cash recovery and accounting remain unavailable. No frontend/native-driver policy expansion. Production/storage/device verification remains separate.

## Compatibility and next step

No request/response contract change. Existing immutable cash/pricing intents remain untouched; receipt-less draft replay stays disabled. Navigation rejects stale unauthorized workspace destinations rather than exposing the previous actor's page. Next: user/browser verification of corrected pricing refresh, localized billing menu and exact component table at desktop/mobile, then review this correction. Do not start another feature batch automatically.
