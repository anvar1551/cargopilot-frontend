/* eslint-disable @typescript-eslint/no-require-imports -- Offline installed TypeScript loader. */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path"),
  Module = require("module"),
  ts = require("typescript");
function compile(name, req) {
  const file = path.join(__dirname, "..", name),
    m = new Module(file, module);
  m.paths = module.paths;
  if (req) m.require = req;
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    file,
  );
  return m.exports;
}
const state = { context: "context-a", epoch: "1" },
  api = {
    defaults: { baseURL: "synthetic" },
    get: async () => ({ data: await state.answer }),
  };
const lib = compile("lib/custody-workspace.ts", (p) =>
  p === "./api"
    ? { api }
    : p === "./auth"
      ? { authContext: () => state.context, authEpoch: () => state.epoch }
      : p === "./creation-intent"
        ? compile("lib/creation-intent.ts")
        : require(p),
);
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const input = {
  payload: {
    orderId: id(1),
    action: "intake",
    expectedEventId: id(2),
    expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    parcelIds: [id(3)],
    warehouseId: id(4),
  },
  display: { orderNumber: "DEMO-ONE", target: "Receiving warehouse" },
};
function io() {
  let raw = null;
  const d = {
    current: () => true,
    read: () => raw,
    write: (v) => {
      raw = v;
    },
    uuid: () => id(5),
    lock: async (f) => f(),
    calls: [],
    send: async (i) => {
      d.calls.push(i);
      return {
        orderId: i.payload.orderId,
        operationId: i.operationId,
        eventId: id(6),
        phase: "warehouse",
        status: "at_warehouse",
        currentWarehouseId: id(4),
        trackingId: id(7),
      };
    },
  };
  return d;
}
test("persists before send and reload retry retains exact operation, content and state basis", async () => {
  const d = io(),
    send = d.send;
  d.send = async (i) => {
    assert.equal(JSON.parse(d.read()).state, "uncertain");
    return send(i);
  };
  const first = await lib.submitCustodyIntent("context-a", input, d);
  assert.equal(first.state, "confirmed");
  assert.deepEqual(await lib.submitCustodyIntent("context-a", null, d), first);
  assert.equal(d.calls[0].operationId, d.calls[1].operationId);
  assert.deepEqual(d.calls[0].payload, d.calls[1].payload);
  assert.deepEqual(d.calls[0].display, d.calls[1].display);
});
test("lost acknowledgement retains original identity for explicit retry", async () => {
  const d = io(),
    send = d.send;
  d.send = async (i) => {
    await send(i);
    throw Error("lost acknowledgement");
  };
  await assert.rejects(lib.submitCustodyIntent("context-a", input, d));
  const original = JSON.parse(d.read());
  assert.equal(original.state, "uncertain");
  d.send = send;
  await lib.submitCustodyIntent("context-a", null, d);
  assert.equal(d.calls[1].operationId, original.operationId);
  assert.deepEqual(d.calls[1].payload, original.payload);
});
test("conflicting targets or expected-state edits cannot retarget an original request", async () => {
  const d = io();
  await lib.submitCustodyIntent("context-a", input, d);
  const raw = d.read();
  for (const payload of [
    { ...input.payload, orderId: id(8) },
    { ...input.payload, expectedEventId: id(8) },
    { ...input.payload, warehouseId: id(8) },
  ])
    await assert.rejects(
      lib.submitCustodyIntent("context-a", { ...input, payload }, d),
      /Conflicting/,
    );
  assert.equal(d.read(), raw);
  assert.equal(d.calls.length, 1);
});
test("storage failure blocks all sending", async () => {
  const d = io();
  d.write = () => {};
  await assert.rejects(
    lib.submitCustodyIntent("context-a", input, d),
    /Persistence failed/,
  );
  assert.equal(d.calls.length, 0);
});
test("foreign context cannot replay stored intent", async () => {
  const d = io();
  await lib.submitCustodyIntent("context-a", input, d);
  await assert.rejects(
    lib.submitCustodyIntent("context-b", null, d),
    /Conflicting/,
  );
  assert.equal(d.calls.length, 1);
});
test("context switch suppresses late confirmation without deleting uncertain intent", async () => {
  const d = io(),
    send = d.send;
  let live = true;
  d.current = () => live;
  d.send = async (i) => {
    const r = await send(i);
    live = false;
    return r;
  };
  await assert.rejects(
    lib.submitCustodyIntent("context-a", input, d),
    /Session changed/,
  );
  assert.equal(JSON.parse(d.read()).state, "uncertain");
});
test("mismatched receipt cannot confirm or overwrite request", async () => {
  const d = io(),
    send = d.send;
  d.send = async (i) => ({ ...(await send(i)), orderId: id(9) });
  await assert.rejects(
    lib.submitCustodyIntent("context-a", input, d),
    /Mismatched/,
  );
  assert.equal(JSON.parse(d.read()).state, "uncertain");
});
test("whole-parcel uniqueness and action-specific targets are validated before persistence", async () => {
  for (const payload of [
    { ...input.payload, parcelIds: [] },
    { ...input.payload, parcelIds: [id(3), id(3)] },
    { ...input.payload, action: "dispatch" },
    { ...input.payload, action: "last-mile-offer" },
  ]) {
    const d = io();
    await assert.rejects(
      lib.submitCustodyIntent("context-a", { ...input, payload }, d),
    );
    assert.equal(d.read(), null);
  }
});
test("nomination receipt is not represented as accepted custody", async () => {
  const d = io();
  d.send = async (i) => ({
    orderId: i.payload.orderId,
    operationId: i.operationId,
    eventId: id(6),
    phase: "last-mile-offered",
    status: "at_warehouse",
    currentWarehouseId: id(4),
    trackingId: id(7),
  });
  const r = await lib.submitCustodyIntent(
    "context-a",
    {
      ...input,
      payload: {
        ...input.payload,
        action: "last-mile-offer",
        driverMembershipId: id(8),
      },
    },
    d,
  );
  assert.equal(r.result.phase, "last-mile-offered");
  assert.equal(r.result.status, "at_warehouse");
});
test("protected reads suppress old-context responses", async () => {
  let release;
  state.answer = new Promise((r) => {
    release = r;
  });
  const p = lib.readCustody("context-a", "/api/orders/custody-work");
  state.epoch = "2";
  release({ items: [] });
  await assert.rejects(p, /Session changed/);
  state.epoch = "1";
});
const routes = compile("lib/order-modal-route.ts");
test("invoice issuance query and nested invoice routes never belong to generic order modal", () => {
  for (const p of [
    "/dashboard/manager/invoices",
    "/dashboard/manager/invoices/",
    "/dashboard/manager/invoices/example",
  ])
    assert.equal(routes.usesGenericOrderModal(p), false);
});
test("genuine generic-modal routes retain behavior; direct detail pages do not mount another detail", () => {
  for (const p of [
    "/dashboard/manager/orders",
    "/dashboard/warehouse",
    "/dashboard/customer/orders",
  ])
    assert.equal(routes.usesGenericOrderModal(p), true);
  for (const role of ["manager", "warehouse", "customer"])
    assert.equal(
      routes.usesGenericOrderModal(`/dashboard/${role}/orders/example`),
      false,
    );
});
test("shell guards both modal opening and child mounting against stale route state", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../components/layout/DashboardShell.tsx"),
    "utf8",
  );
  assert.match(source, /genericModalRoute && Boolean\(activeOrderModalId\)/);
  assert.match(source, /showOrderModal && activeOrderModalId \?/);
  assert.match(
    source,
    /genericModalRoute \? searchParams.get\("order"\) : null/,
  );
});

const navigation = compile("lib/acceptance-corrections.ts");
test("authorized warehouse deep link survives a company-operations home; permission alone never grants server scope", () => {
  const user = {
    tenantId: id(1),
    companyId: id(2),
    companyMembershipId: id(3),
    tenantMembershipId: id(4),
    permissionCodes: ["shipment.view", "shipment.custody.intake"],
  };
  assert.equal(
    navigation.postLoginDestination(
      user,
      "/dashboard/warehouse",
      "/dashboard/manager",
    ),
    "/dashboard/warehouse",
  );
  assert.equal(
    navigation.postLoginDestination(
      { ...user, permissionCodes: ["shipment.view"] },
      "/dashboard/warehouse",
      "/dashboard/manager",
    ),
    "/dashboard/manager",
  );
});

function markup(mode) {
  const React = require("react"),
    render = require("react-dom/server").renderToStaticMarkup;
  const ui = compile(
    "components/workspace/WarehouseOperationsWorkspace.tsx",
    (p) => {
      if (p === "next/navigation")
        return { useSearchParams: () => new URLSearchParams() };
      if (p === "next/link")
        return {
          __esModule: true,
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        };
      if (p === "@/lib/workspace")
        return {
          useWorkspaceSession: () => ({
            context: "context-a",
            epoch: "1",
            user: {
              permissionCodes:
                mode === "denied"
                  ? []
                  : ["shipment.view", "shipment.custody.intake"],
            },
          }),
        };
      if (p === "@/lib/auth")
        return {
          authContext: () => state.context,
          authEpoch: () => state.epoch,
          hasPermission: (u, k) => u?.permissionCodes.includes(k),
        };
      if (p === "@tanstack/react-query")
        return {
          useQueryClient: () => ({}),
          useQuery: ({ queryKey }) =>
            queryKey[0] === "custody-work"
              ? {
                  isPending: mode === "loading",
                  data:
                    mode === "populated"
                      ? {
                          items: [
                            {
                              orderId: id(1),
                              orderNumber: "SYN-Long-Operational-Order",
                              phase: "pickup-offered",
                              status: "picked_up",
                              expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
                            },
                          ],
                        }
                      : undefined,
                  error:
                    mode === "error" ? Error("Source unavailable") : undefined,
                }
              : { data: [] },
        };
      if (p === "@/lib/custody-workspace") return lib;
      if (p === "@/lib/service-cash") return { cashError: (e) => e.message };
      if (p === "@/components/layout/PageShell")
        return {
          __esModule: true,
          default: ({ children, ...props }) =>
            React.createElement("main", props, children),
        };
      if (p === "./WorkspaceState")
        return {
          __esModule: true,
          default: ({ kind, title, description }) =>
            React.createElement(
              "section",
              { "data-state": kind },
              title,
              description,
            ),
        };
      if (p === "./PricingWorkflowShared")
        return {
          control: "bounded-control",
          Field: ({ label, children }) =>
            React.createElement("label", null, label, children),
        };
      if (p === "@/components/ui/button")
        return {
          Button: ({ variant, ...props }) => {
            void variant;
            return React.createElement("button", props);
          },
        };
      return require(p);
    },
  );
  return render(React.createElement(ui.default));
}
test("actual static markup renders operational names, scan control and page-bounded manifest without UUID text", () => {
  const h = markup("populated");
  assert.match(h, /SYN-Long-Operational-Order/);
  assert.match(h, /Scan parcel code or exact order number/);
  assert.match(h, /Print this work page/);
  assert.ok(!h.includes(id(1)));
  assert.match(h, /No bulk custody action/);
});
test("actual static markup distinguishes loading, denied and failed reads without fabricated actions", () => {
  assert.match(markup("loading"), /Loading current work/);
  assert.match(markup("denied"), /Warehouse access unavailable/);
  assert.match(markup("error"), /Source unavailable/);
});

const warehousePermissions = compile("lib/orders/permissions.ts", (p) =>
  p === "@/lib/auth" ? { hasPermission: () => true } : require(p),
);
test("legacy warehouse detail capabilities cannot expose competing generic, assignment or cash mutations", () => {
  const c = warehousePermissions.getWarehouseOrderCapabilities({});
  for (const k of [
    "canAssignDriver",
    "canChangeStatus",
    "canSettleCash",
    "canHandleWarehouseCash",
    "canRetryPayment",
    "canBookCarrier",
    "canDelete",
  ])
    assert.equal(c[k], false);
  assert.equal(c.canOpenDetails, true);
});
test("warehouse detail bookmarks redirect into canonical preflight without generic detail mounting", () => {
  const s = fs.readFileSync(
    path.join(__dirname, "../app/dashboard/warehouse/orders/[id]/page.tsx"),
    "utf8",
  );
  assert.match(s, /warehouse\?custody=/);
  assert.ok(!s.includes("OrderDetailsView"));
});
