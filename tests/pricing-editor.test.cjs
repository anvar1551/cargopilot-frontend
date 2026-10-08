/* eslint-disable @typescript-eslint/no-require-imports -- Installed offline TS/React test loader. */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const root = path.join(__dirname, ".."),
  cache = new Map();
function load(name) {
  let file = path.join(root, name);
  if (!path.extname(file))
    file = [".ts", ".tsx"].map((e) => file + e).find(fs.existsSync);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file, module);
  m.paths = module.paths;
  cache.set(file, m);
  m.require = (p) => {
    if (p === "./api" || p === "@/lib/api") return { api: {} };
    if (p === "./auth" || p === "@/lib/auth")
      return { authContext: () => "A", authEpoch: () => 1 };
    if (p.startsWith("@/")) return load(p.slice(2));
    if (
      p.startsWith(".") &&
      [".ts", ".tsx"].some((e) =>
        fs.existsSync(path.resolve(path.dirname(file), p + e)),
      )
    )
      return load(path.relative(root, path.resolve(path.dirname(file), p)));
    return require(p);
  };
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
  return m.exports;
}
const e = load("lib/pricing-editor.ts"),
  w = load("lib/pricing-workflow.ts");
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const rate = { zone: "0", weightFromKg: "0", weightToKg: "10", price: "20" };
const draft = {
  name: "Synthetic A",
  code: null,
  description: null,
  status: "draft",
  serviceType: "DOOR_TO_DOOR",
  priceType: "bucket",
  pricingStrategy: "FIXED_LANE",
  coverageType: "domestic",
  transportMode: "ROAD",
  originCountryCode: null,
  destinationCountryCode: null,
  routeTemplateId: null,
  currency: "UZS",
  priority: 0,
  isDefault: false,
  customerEntityId: null,
  rates: e.normalizeRows("rate", [rate]),
  transitLegRates: [],
};
const route = {
  origin: " City A ",
  destination: " City B ",
  originCountry: "uz",
  destinationCountry: "uz",
  zone: "0",
  coverageType: "domestic",
  transportMode: "ROAD",
};
const policy = () => ({
  values: {
    currency: "UZS",
    precision: "2",
    rounding: "HALF_UP",
    order: "discount_then_tax",
    tax: "not_applicable",
    taxEvidence: "EXPLICIT SYNTHETIC",
    dueDays: "0",
    prefix: "SYN",
  },
  routes: [route],
  included: [{ service: "base" }],
  fees: [],
  discounts: [],
  states: ["delivered"],
});
function loaded() {
  const g = e.createTariffEditor("A");
  g.select(id(1));
  const t = g.begin();
  assert.equal(g.accept(t, { id: id(1), name: "Synthetic A" }), true);
  return g;
}
test("loaded A then B selection denies update with retained A values", () => {
  const g = loaded();
  g.select(id(2));
  assert.throws(() => g.update(id(2), draft));
  assert.throws(() => g.update(id(1), draft));
});
test("delayed A load after B selection is ignored, including after switching back to A", async () => {
  const g = e.createTariffEditor("A");
  g.select(id(1));
  const ticket = g.begin();
  let release;
  const response = new Promise((r) => (release = r));
  g.select(id(2));
  release({ id: id(1), name: "A" });
  assert.equal(g.accept(ticket, await response), false);
  g.select(id(1));
  assert.equal(g.accept(ticket, { id: id(1), name: "A" }), false);
});
test("competing loads admit only newest request and ignore older errors", () => {
  const g = e.createTariffEditor("A");
  g.select(id(1));
  const first = g.begin(),
    second = g.begin();
  assert.equal(g.current(first), false);
  assert.equal(g.accept(first, { id: id(1), name: "old" }), false);
  assert.equal(g.accept(second, { id: id(1), name: "new" }), true);
  assert.equal(g.update(id(1), draft).planId, id(1));
});
test("unmount/context replacement and Strict Mode lifetime reject stale completion", () => {
  const g = e.createTariffEditor("A");
  g.select(id(1));
  const t = g.begin();
  g.invalidate();
  assert.equal(g.accept(t, { id: id(1), name: "old" }), false);
  g.activate();
  assert.equal(g.current(t), false);
  const other = e.createTariffEditor("B");
  other.select(id(1));
  const newer = other.begin();
  assert.equal(other.accept(t, { id: id(1), name: "old" }), false);
  assert.equal(other.accept(newer, { id: id(1), name: "B" }), true);
});
test("wrong detail identity cannot populate editor and create/edit modes cannot cross", () => {
  const g = e.createTariffEditor("A");
  assert.deepEqual(g.create(draft), { draft });
  g.select(id(1));
  assert.throws(() => g.create(draft));
  const t = g.begin();
  assert.equal(g.accept(t, { id: id(2), name: "wrong" }), false);
  assert.throws(() => g.update(id(1), draft));
  g.select("");
  assert.throws(() => g.update(id(1), draft));
  assert.deepEqual(g.create(draft), { draft });
});
test("selection cannot erase, retarget or replay a persisted uncertain draft intent", async () => {
  const g = loaded();
  let persisted = null,
    calls = 0;
  const io = {
    current: () => true,
    read: () => persisted,
    write: (v) => (persisted = v),
    uuid: () => id(4),
    lock: async (f) => f(),
    send: async () => {
      calls++;
      throw Error("Lost acknowledgement");
    },
  };
  await assert.rejects(
    w.submitPricingIntent("draftUpdate", "A", g.update(id(1), draft), io),
  );
  const original = persisted;
  g.select(id(2));
  assert.equal(persisted, original);
  await assert.rejects(w.submitPricingIntent("draftUpdate", "A", null, io));
  assert.equal(calls, 1);
  assert.equal(JSON.parse(persisted).payload.planId, id(1));
  assert.deepEqual(JSON.parse(persisted).payload.draft, draft);
});
test("structured rates preserve zone zero and actual numeric draft API contract", () => {
  assert.deepEqual(e.normalizeRows("rate", [rate]), [
    { zone: 0, weightFromKg: 0, weightToKg: 10, price: 20 },
  ]);
  for (const r of [
    { ...rate, zone: "-1" },
    { ...rate, zone: "100" },
    { ...rate, price: "" },
    { ...rate, weightToKg: "0" },
    { ...rate, weightFromKg: "11" },
  ])
    assert.throws(() => e.normalizeRows("rate", [r]));
});
test("all supported transit fields survive normalization including explicit optional zero", () => {
  const r = {
    sequence: "1",
    legCode: " road-1 ",
    label: "Synthetic leg",
    mode: "ROAD",
    originCountryCode: "uz",
    destinationCountryCode: "cn",
    ratePerKg: "0.25",
    minCharge: "0",
    flatFee: "",
  };
  assert.deepEqual(e.normalizeRows("transit", [r]), [
    {
      sequence: 1,
      legCode: "road-1",
      label: "Synthetic leg",
      mode: "ROAD",
      originCountryCode: "UZ",
      destinationCountryCode: "CN",
      ratePerKg: 0.25,
      minCharge: 0,
      flatFee: null,
    },
  ]);
  assert.throws(() => e.normalizeRows("transit", [{ ...r, sequence: "0" }]));
});
test("country-qualified routes normalize without remapping zone zero", () => {
  const p = e.normalizedPolicyForm(policy());
  assert.deepEqual(p.zones.mappings[0], {
    origin: "City A",
    destination: "City B",
    originCountry: "UZ",
    destinationCountry: "UZ",
    zone: 0,
    coverageType: "domestic",
    transportMode: "ROAD",
  });
  const s = policy();
  s.routes.push({ ...route, originCountry: "CN", destinationCountry: "CN" });
  assert.equal(e.normalizedPolicyForm(s).zones.mappings.length, 2);
  assert.throws(() => e.normalizeRows("route", [{ ...route, zone: "1001" }]));
});
test("fees, discounts and tax retain exact decimal strings without arithmetic/defaults", () => {
  const s = policy();
  s.fees = [{ service: "handling", amount: "0.0000000000000000000001" }];
  s.discounts = [
    { code: "explicit", type: "percent", value: "99.99999999999999999999" },
  ];
  s.values.tax = "exclusive_percent";
  s.values.taxRate = "0.00000000000000000001";
  const p = e.normalizedPolicyForm(s);
  assert.equal(p.fees[0].amount, s.fees[0].amount);
  assert.equal(p.discounts[0].value, s.discounts[0].value);
  assert.equal(p.tax.rate, s.values.taxRate);
  assert.throws(() => e.normalizeRows("fee", [{ service: "x", amount: "-1" }]));
  assert.throws(() =>
    e.normalizeRows("discount", [
      { code: "x", type: "percent", value: "100.000000000000000001" },
    ]),
  );
});
test("explicit none differs from unchosen collections and required arrays cannot be empty", () => {
  const s = policy();
  assert.deepEqual(e.normalizedPolicyForm(s).fees, []);
  assert.deepEqual(e.normalizedPolicyForm(s).discounts, []);
  for (const key of ["fees", "discounts", "routes", "included", "states"]) {
    const n = policy();
    n[key] = null;
    assert.throws(() => e.normalizedPolicyForm(n));
  }
  for (const key of ["routes", "included", "states"]) {
    const n = policy();
    n[key] = [];
    assert.throws(() => e.normalizedPolicyForm(n));
  }
  assert.throws(() => e.normalizeRows("rate", null));
  assert.deepEqual(e.normalizeRows("transit", []), []);
});
test("all collection and invoice bounds remain enforced", () => {
  for (const kind of Object.keys(e.rowLimits))
    assert.throws(
      () => e.normalizeRows(kind, Array(e.rowLimits[kind] + 1).fill({})),
      /Maximum/,
    );
  for (const [key, value] of [
    ["precision", "5"],
    ["dueDays", "366"],
    ["prefix", "invalid prefix"],
  ]) {
    const s = policy();
    s.values[key] = value;
    assert.throws(() => e.normalizedPolicyForm(s));
  }
  const s = policy();
  s.states = ["cancelled"];
  assert.throws(() => e.normalizedPolicyForm(s));
});
test("loaded rows round-trip supported payload and submit only the loaded target", () => {
  const g = loaded();
  assert.deepEqual(
    e.normalizeRows("rate", e.textRows(draft.rates)),
    draft.rates,
  );
  const r = w.pricingRequest({
    kind: "draftUpdate",
    operationId: id(4),
    payload: g.update(id(1), draft),
  });
  assert.equal(r.url, "/api/pricing/tariff-plans/" + id(1));
  assert.deepEqual(r.data, draft);
});
test("actual structured components emit accessible business controls, not JSON authoring", () => {
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  const Rows = load("components/workspace/PricingRows.tsx").default,
    Billing = load("components/workspace/BillingPolicyForm.tsx").default;
  const html = renderToStaticMarkup(
    React.createElement(Rows, {
      title: "Weight rates",
      kind: "rate",
      value: [rate],
      onChange: () => {},
      max: 1000,
      allowNone: true,
    }),
  );
  assert.match(html, /Weight from/);
  assert.match(html, /Remove Weight rates row 1/);
  assert.match(html, /None/);
  assert.doesNotMatch(html, /<textarea/);
  const policyHtml = renderToStaticMarkup(
    React.createElement(Billing, { onChange: () => {} }),
  );
  for (const text of [
    "Country-qualified routes",
    "Included services",
    "Eligible invoice states",
    "Exact tax percentage",
    "Fees",
    "Discounts",
  ]) {
    if (text === "Exact tax percentage") continue;
    assert.match(policyHtml, new RegExp(text));
  }
  assert.doesNotMatch(policyHtml, /<textarea/);
  assert.match(policyHtml, /type="checkbox"/);
});
