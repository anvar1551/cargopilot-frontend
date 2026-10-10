/* eslint-disable @typescript-eslint/no-require-imports -- Installed offline TypeScript loader. */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path"),
  Module = require("module"),
  ts = require("typescript");
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0"),
  context = JSON.stringify([id(1), id(2), id(3), id(4), id(5)]);
function compile(file, req) {
  const m = new Module(file, module);
  m.paths = module.paths;
  if (req) m.require = req;
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
  return m.exports;
}
function load() {
  const state = { context, epoch: 1 };
  return {
    ...compile(path.join(__dirname, "../lib/invoice-workspace.ts"), (p) =>
      p === "./api"
        ? {
            api: {
              defaults: { baseURL: "synthetic" },
              get: async () => ({
                data: state.wait
                  ? await state.wait
                  : (state.answer ?? { items: [] }),
              }),
            },
          }
        : p === "./auth"
          ? { authContext: () => state.context, authEpoch: () => state.epoch }
          : p === "./creation-intent"
            ? compile(path.join(__dirname, "../lib/creation-intent.ts"))
            : require(p),
    ),
    state,
  };
}
const payload = {
    orderId: id(6),
    priceApprovalId: id(7),
    reason: "Explicit issuance",
  },
  display = {
    orderNumber: "SYN-ORDER",
    payerName: "Synthetic payer",
    amount: "100.0000",
    currency: "UZS",
  },
  input = { payload, display };
const result = () => ({
  id: id(8),
  orderId: id(6),
  invoiceNumber: "SYN-INVOICE",
  amount: "100.0000",
  currency: "UZS",
  status: "issued",
  billing: { priceApprovalId: id(7) },
});
function io() {
  let raw = null;
  const d = {
    current: () => true,
    read: () => raw,
    write: (v) => (raw = v),
    uuid: () => id(10),
    lock: async (f) => f(),
    calls: [],
    send: async (i) => {
      assert.equal(JSON.parse(raw).state, "uncertain");
      assert.equal(JSON.parse(raw).operationId, i.operationId);
      d.calls.push(i);
      return result();
    },
  };
  return d;
}
test("persist before send, restart and matching retries retain exact source/content/identity", async () => {
  const a = load(),
    d = io();
  await a.submitInvoiceIntent(context, input, d);
  const original = d.read();
  await load().submitInvoiceIntent(context, null, d);
  assert.equal(d.read(), original);
  assert.equal(d.calls[0].operationId, d.calls[1].operationId);
  assert.deepEqual(d.calls[0].payload, d.calls[1].payload);
});
test("conflicting order/approval/reason/context cannot retarget an uncertain request", async () => {
  const a = load(),
    d = io();
  d.send = async () => {
    throw Error("Ambiguous");
  };
  await assert.rejects(a.submitInvoiceIntent(context, input, d));
  const raw = d.read();
  for (const next of [
    { ...payload, orderId: id(20) },
    { ...payload, priceApprovalId: id(20) },
    { ...payload, reason: "Changed" },
  ])
    await assert.rejects(
      a.submitInvoiceIntent(context, { payload: next, display }, d),
    );
  await assert.rejects(a.submitInvoiceIntent("foreign", null, d));
  assert.equal(d.read(), raw);
});
test("ownership, amount, due date, paid-state and unsupported fields reject before persistence/send", async () => {
  for (const field of ["amount", "currency", "tenantId", "paid", "dueAt"]) {
    const a = load(),
      d = io();
    await assert.rejects(
      a.submitInvoiceIntent(
        context,
        { payload: { ...payload, [field]: "unsafe" }, display },
        d,
      ),
    );
    assert.equal(d.calls.length, 0);
    assert.equal(d.read(), null);
  }
});
test("storage failure and failed readback cannot permit sending", async () => {
  for (const throws of [true, false]) {
    const a = load(),
      d = io();
    d.write = () => {
      if (throws) throw Error("Storage unavailable");
    };
    await assert.rejects(a.submitInvoiceIntent(context, input, d));
    assert.equal(d.calls.length, 0);
  }
});
test("competing browser lock cannot send or allocate another request", async () => {
  const a = load(),
    d = io();
  d.lock = async () => {
    throw Error("Other tab");
  };
  await assert.rejects(a.submitInvoiceIntent(context, input, d));
  assert.equal(d.calls.length, 0);
  assert.equal(d.read(), null);
});
test("late confirmation after context/session change leaves original uncertain", async () => {
  const a = load(),
    d = io();
  let live = true;
  d.current = () => live;
  d.send = async () => {
    live = false;
    return result();
  };
  await assert.rejects(a.submitInvoiceIntent(context, input, d));
  assert.equal(JSON.parse(d.read()).state, "uncertain");
});
test("lost acknowledgement recovers only with original explicit retry and identity", async () => {
  const a = load(),
    d = io();
  d.send = async (i) => {
    d.calls.push(i);
    throw Error("Timeout");
  };
  await assert.rejects(a.submitInvoiceIntent(context, input, d));
  const original = d.calls[0];
  d.uuid = () => {
    throw Error("New identity forbidden");
  };
  d.send = async (i) => {
    d.calls.push(i);
    return result();
  };
  await a.submitInvoiceIntent(context, null, d);
  assert.deepEqual(d.calls[1], original);
});
test("mismatched confirmation cannot mark receipt confirmed; exact decimals are not rounded", async () => {
  for (const change of [
    { orderId: id(20) },
    { amount: "100.01" },
    { currency: "USD" },
    { billing: { priceApprovalId: id(20) } },
  ]) {
    const a = load(),
      d = io();
    d.send = async () => ({ ...result(), ...change });
    await assert.rejects(a.submitInvoiceIntent(context, input, d));
    assert.equal(JSON.parse(d.read()).state, "uncertain");
  }
});
test("minimal persisted confirmation excludes returned payment/storage/internal fields", async () => {
  const a = load(),
    d = io();
  d.send = async () => ({
    ...result(),
    paymentUrl: "private",
    invoiceKey: "private",
    secret: "private",
  });
  await a.submitInvoiceIntent(context, input, d);
  assert(!d.read().includes("private"));
});
test("late discovery response cannot populate a new selected context", async () => {
  const a = load();
  a.state.wait = new Promise((r) => (a.state.resolve = r));
  const p = a.readInvoiceWorkspace(context, { view: "invoices" });
  a.state.epoch++;
  a.state.resolve({ items: [] });
  await assert.rejects(p);
});
test("business text contains no rendered UUID; absent names are honest", () => {
  const a = load();
  assert.equal(a.businessText(null), "Unavailable");
  assert(!a.businessText("Source " + id(20)).includes(id(20)));
  assert.equal(
    a.invoiceError({ response: { data: { error: "Reference " + id(20) } } }),
    "Reference [internal reference]",
  );
});
test("canonical navigation and invoice-only deep link retain valid intent without shipment authority", () => {
  const a = compile(path.join(__dirname, "../lib/acceptance-corrections.ts"));
  const u = {
    tenantId: id(2),
    companyId: id(3),
    companyMembershipId: id(4),
    tenantMembershipId: id(5),
    permissionCodes: ["finance.invoices.issue"],
  };
  const next = "/dashboard/manager/invoices?order=" + id(6);
  assert.equal(a.postLoginDestination(u, next, "/dashboard/manager"), next);
  assert.equal(
    a.postLoginDestination(
      { ...u, permissionCodes: [] },
      next,
      "/dashboard/manager",
    ),
    "/dashboard/manager",
  );
  const source = fs.readFileSync(
    path.join(__dirname, "../components/erp/sidebar/ErpSidebar.tsx"),
    "utf8",
  );
  assert.match(source, /href: "\/dashboard\/manager\/invoices"/);
});

test("signed file adapter rejects unsupported URLs and suppresses late-context responses", async () => {
  for (const url of ["javascript:alert(1)", "data:text/plain,unsafe"]) {
    const a = load();
    a.state.answer = { url };
    await assert.rejects(a.invoiceDownload(context, id(6)));
  }
  const a = load();
  a.state.answer = { url: "https://synthetic.invalid/invoice.pdf" };
  assert.equal(await a.invoiceDownload(context, id(6)), a.state.answer.url);
  a.state.wait = new Promise((r) => (a.state.resolve = r));
  const pending = a.invoiceDownload(context, id(6));
  a.state.epoch++;
  a.state.resolve(a.state.answer);
  await assert.rejects(pending);
});

function renderInvoice(mode, pending = false) {
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  let slot = 0;
  const invoice = {
    id: id(8),
    orderId: id(6),
    invoiceNumber: "SYN-INVOICE",
    orderNumber: "SYN-ORDER",
    companyName: "Synthetic company",
    payer: { name: "Synthetic payer", companyName: null },
    issuerName: "Synthetic issuer",
    amount: "100.0000",
    currency: "UZS",
    status: "issued",
    issuedAt: null,
    dueAt: null,
    hasFile: false,
    accounting: "Held accounting facts",
  };
  const prep = {
    order: { id: id(6), orderNumber: "SYN-ORDER", status: "assigned" },
    companyName: invoice.companyName,
    baseCurrency: "UZS",
    payer: invoice.payer,
    price: {
      id: id(7),
      total: "100.0000",
      currency: "UZS",
      components: [
        { type: "base", amount: "100.0000", code: null, basis: null },
      ],
    },
    existing: null,
    eligibleStates: ["assigned"],
    reasons: [],
    eligible: true,
  };
  const file = path.join(
      __dirname,
      "../components/workspace/InvoiceWorkspace.tsx",
    ),
    m = new Module(file, module);
  m.paths = module.paths;
  m.require = (p) => {
    if (p === "react")
      return {
        ...React,
        useEffect: () => {},
        useState: (v) =>
          React.useState(
            {
              0: mode,
              3: id(6),
              4: "Explicit issuance",
              5: pending
                ? {
                    version: 1,
                    context,
                    operationId: id(10),
                    payload,
                    display,
                    state: "uncertain",
                  }
                : null,
              6: true,
            }[slot++] ?? v,
          ),
      };
    if (p === "@/lib/workspace")
      return { useWorkspaceSession: () => ({ user: {}, context, epoch: 1 }) };
    if (p === "@/lib/auth")
      return {
        hasPermission: (_u, k) =>
          ["finance.invoices.read", "finance.invoices.issue"].includes(k),
        authContext: () => context,
        authEpoch: () => 1,
      };
    if (p === "@/lib/invoice-workspace") return load();
    if (p === "@tanstack/react-query")
      return {
        useQuery: (o) => ({
          data:
            o.queryKey[0] === "invoice-detail"
              ? mode === "invoices"
                ? invoice
                : prep
              : {
                  items: [mode === "invoices" ? invoice : prep.order],
                  nextCursor: null,
                },
          isPending: false,
          error: null,
          refetch: async () => {},
        }),
      };
    if (p === "next/navigation")
      return { useSearchParams: () => new URLSearchParams() };
    if (p === "next/link")
      return {
        __esModule: true,
        default: ({ children, ...props }) =>
          React.createElement("a", props, children),
      };
    if (p === "@/components/layout/PageShell")
      return {
        __esModule: true,
        default: ({ children }) => React.createElement("main", null, children),
      };
    if (p === "./WorkspaceState")
      return {
        __esModule: true,
        default: ({ title, description }) =>
          React.createElement("section", null, title, description),
      };
    if (p === "@/components/ui/button")
      return {
        Button: ({ children, variant, ...props }) => {
          void variant;
          return React.createElement("button", props, children);
        },
      };
    if (p === "./PricingWorkflowShared")
      return {
        Field: ({ label, children }) =>
          React.createElement("label", null, label, children),
        control: "control",
      };
    return require(p);
  };
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
  return renderToStaticMarkup(React.createElement(m.exports.default));
}
test("actual register markup shows business names, exact values and absent PDF without rendered UUIDs/JSON", () => {
  const html = renderInvoice("invoices");
  for (const label of [
    "SYN-INVOICE",
    "SYN-ORDER",
    "Synthetic payer",
    "Synthetic issuer",
    "100.0000 UZS",
    "No generated PDF",
  ])
    assert(html.includes(label));
  assert(!html.includes(id(6)));
  assert(!html.includes(id(8)));
  assert(!html.includes("<pre"));
  assert(!html.includes("Mark paid"));
});
test("actual issuance markup has labelled reason, bounded components and no money/ownership authoring", () => {
  const html = renderInvoice("orders");
  assert.match(html, /Reason for manual issuance/);
  assert.match(html, /Accepted exact invoice components/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /Issue manual invoice/);
  assert(!html.includes(id(7)));
  assert(!html.includes('type="number"'));
  assert(!html.includes("<pre"));
});
test("actual uncertain receipt markup retains original request and prevents new issuance", () => {
  const html = renderInvoice("orders", true);
  assert.match(html, /Unconfirmed issuance/);
  assert.match(html, /Retry original issuance/);
  assert(!html.includes(">Issue manual invoice<"));
  assert(!html.includes("start new action"));
  assert(!html.includes(id(10)));
});

test("rejections explain policy and receipt conflicts without treating all conflicts as changed identity", () => {
  const a = load();
  assert.match(
    a.invoiceError({
      response: {
        status: 409,
        data: { error: "BILLING_ORDER_STATE_INELIGIBLE" },
      },
    }),
    /invoice-eligible state/,
  );
  assert.match(
    a.invoiceError({
      response: { status: 409, data: { error: "BILLING_INTENT_CONFLICT" } },
    }),
    /different content/,
  );
  assert.match(a.invoiceError({ response: { status: 403 } }), /authority/);
});
