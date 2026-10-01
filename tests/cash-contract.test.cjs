const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
function load(file, mocks = {}) {
  const filename = path.join(__dirname, '..', 'lib', file + '.ts');
  const mod = new Module(filename, module);
  mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  return mod.exports;
}
const core = load('cash-intent');
const user = { id: 'user-a', tenantId: 'tenant-a', tenantMembershipId: 'tm-a', companyId: 'company-a', companyMembershipId: 'cm-a', membershipId: 'cm-a' };
function harness() {
  let raw = null, context = core.cashContext(user), calls = [], prepares = 0;
  let error, confirmation = true;
  const deps = {
    context: async () => context,
    read: async () => raw,
    write: async value => { raw = value; },
    confirm: async () => confirmation,
    prepare: async () => { prepares++; return { path: '/cash/handoff', body: { operationId: 'saved-operation', expectedEventId: 'old-event' } }; },
    send: async record => { calls.push(JSON.parse(JSON.stringify(record))); if (error) throw error; return { success: true, order: { cashCollections: [{ collectedAmount: '9007199254740993.0001' }] } }; },
  };
  return { deps, calls, get raw() { return raw; }, get prepares() { return prepares; }, set error(e) { error = e; }, set context(v) { context = v; }, set confirmation(v) { confirmation = v; } };
}
test('selected identity requires all bridge fields and agreement', () => {
  for (const field of Object.keys(user)) assert.throws(() => core.cashContext({ ...user, [field]: null }));
  assert.throws(() => core.cashContext({ ...user, membershipId: 'foreign' }));
});
test('decimal strings remain exact; no numeric financial conversion', () => {
  assert.equal(core.cashDecimal('9007199254740993.0001', 'USD'), '9007199254740993.0001 USD');
  assert.equal(core.cashDecimal(null), 'Unavailable');
});
test('custody snapshot chooses newest event with deterministic tie break', () => {
  const first = '11111111-1111-1111-1111-111111111111', second = '22222222-2222-2222-2222-222222222222';
  assert.equal(core.custodyEvent({ cashCollections: [{ kind: 'cod', status: 'held', events: [{ id: first, createdAt: '2026-01-01' }, { id: second, createdAt: '2026-01-01' }] }] }, 'cod'), second);
  assert.throws(() => core.custodyEvent({ cashCollections: [] }, 'cod'));
});
test('intent persisted before send and cleared on confirmed success', async () => {
  const h = harness(); const original = h.deps.send;
  h.deps.send = async record => { assert.ok(h.raw); return original(record); };
  const result = await core.executeCashIntent('same', h.deps);
  assert.equal(result.order.cashCollections[0].collectedAmount, '9007199254740993.0001'); assert.equal(h.raw, null);
});
test('timeout and restart retain exact operation and stale custody event', async () => {
  const h = harness(); h.error = new Error('timeout');
  await assert.rejects(core.executeCashIntent('same', h.deps), /uncertain/);
  const saved = h.raw; h.error = undefined;
  // Fresh executor dependencies represent reload/restart; persistence survives.
  await core.executeCashIntent('same', { ...h.deps, read: async () => saved });
  assert.equal(h.prepares, 1); assert.deepEqual(h.calls[0].body, h.calls[1].body);
});
test('changed destination or payload cannot reuse pending intent', async () => {
  const h = harness(); h.error = new Error('timeout'); await assert.rejects(core.executeCashIntent('original', h.deps));
  await assert.rejects(core.executeCashIntent('changed', h.deps), /unresolved/); assert.equal(h.calls.length, 1);
});
test('identity or company switch prevents replay', async () => {
  const h = harness(); h.error = new Error('timeout'); await assert.rejects(core.executeCashIntent('same', h.deps));
  h.context = core.cashContext({ ...user, tenantId: 'tenant-b', companyMembershipId: 'cm-b', membershipId: 'cm-b' });
  await assert.rejects(core.executeCashIntent('same', h.deps), /another login/); assert.equal(h.calls.length, 1);
});
test('permission, ownership and stale-state failures cannot replay', async () => {
  for (const status of [400, 401, 403, 404, 409]) {
    const h = harness(); h.error = { response: { status } };
    await assert.rejects(core.executeCashIntent('same', h.deps), /rejected/);
    await assert.rejects(core.executeCashIntent('same', h.deps), /no replay/); assert.equal(h.calls.length, 1);
  }
});
test('manual retry cancellation preserves unresolved intent', async () => {
  const h = harness(); h.error = new Error('timeout'); await assert.rejects(core.executeCashIntent('same', h.deps));
  h.confirmation = false; await assert.rejects(core.executeCashIntent('same', h.deps), /cancelled/); assert.ok(h.raw); assert.equal(h.calls.length, 1);
});
test('failed durable write produces no request', async () => {
  const h = harness(); h.deps.write = async () => { throw new Error('storage'); };
  await assert.rejects(core.executeCashIntent('same', h.deps), /storage/); assert.equal(h.calls.length, 0);
});
test('context switch during preparation produces no request', async () => {
  const h = harness(); const original = h.deps.prepare;
  h.deps.prepare = async () => { h.context = 'other'; return original(); };
  await assert.rejects(core.executeCashIntent('same', h.deps), /identity changed/); assert.equal(h.calls.length, 0);
});
test('new confirmed action generates a new operation; uncertain action does not', async () => {
  const h = harness(); h.deps.prepare = async () => ({ path: '/cash', body: { operationId: `op-${h.calls.length}` } });
  await core.executeCashIntent('same', h.deps); await core.executeCashIntent('same', h.deps);
  assert.notEqual(h.calls[0].body.operationId, h.calls[1].body.operationId);
});
test('actual cash adapter strips monetary inputs and binds request context', async () => {
  const driver = fs.existsSync(path.join(__dirname, '..', 'expo-env.d.ts')) || JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).name.includes('driver');
  let raw = null; const posts = [];
  global.window = { localStorage: { getItem: () => raw, setItem: (_, v) => { raw = v; }, removeItem: () => { raw = null; } }, confirm: () => true };
  Object.defineProperty(global, "navigator", { configurable: true, value: { locks: { request: async (_, opts, callback) => callback({}) } } });
  const adapter = load('cash', {
    './cash-intent': core,
    './api': { api: { post: async (...args) => { posts.push(args); return { data: { success: true } }; }, get: async () => ({ data: { cashCollections: [{ kind: 'cod', status: 'held', events: [{ id: '11111111-1111-1111-1111-111111111111', createdAt: '2026-01-01' }] }] } }) } },
    './auth': { getUser: () => driver ? Promise.resolve(user) : user },
    'expo-secure-store': { getItemAsync: async () => raw, setItemAsync: async (_, v) => { raw = v; }, deleteItemAsync: async () => { raw = null; } },
    'react-native': { Platform: { OS: 'ios' }, Alert: { alert: () => { throw new Error('Unexpected confirmation'); } } },
  });
  if (driver) await adapter.collectCash({ orderId: 'order-a', kind: 'cod', amount: 999, tenantId: 'foreign' });
  else {
    await adapter.mutateCash('collect', [{ orderId: 'order-a', kind: 'cod', amount: 999 }]);
    await adapter.mutateCash('handoff', [{ orderId: 'order-a', kind: 'cod' }], { toHolderType: 'driver', toDriverId: 'driver-a', amount: 999 });
    assert.equal(posts[1][1].expectedEventId, '11111111-1111-1111-1111-111111111111');
  }
  assert.ok(posts[0][1].operationId); assert.ok(!('amount' in posts[0][1])); assert.ok(!('tenantId' in posts[0][1])); assert.equal(posts[0][2].cashContext, core.cashContext(user));
});
test('cash requests bypass automatic auth replay and old route fallback is absent', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'lib', 'api.ts'), 'utf8');
  assert.match(api, /cashContext\) return Promise.reject\(error\)/);
  const orders = fs.readFileSync(path.join(__dirname, '..', 'lib', 'orders.ts'), 'utf8');
  assert.doesNotMatch(orders, /api.post\("\/api\/orders\/cash\/collect"/);
});

test('partial bulk results retain the original unresolved identity', async () => {
  const h = harness(); h.deps.send = async () => ({ success: false, count: 1, failedCount: 1 });
  await core.executeCashIntent('bulk', h.deps); const saved = h.raw;
  assert.equal(JSON.parse(saved).blocked, undefined);
  await assert.rejects(core.executeCashIntent('different', h.deps), /unresolved/); assert.equal(h.raw, saved);
});
test('partial result after timeout cannot replace saved operations or custody snapshots', async () => {
  const h = harness(); h.error = new Error('timeout'); await assert.rejects(core.executeCashIntent('bulk', h.deps)); const saved = h.raw;
  h.deps.send = async record => { assert.deepEqual(record.body, JSON.parse(saved).body); return { success: false, failedCount: 1 }; };
  await core.executeCashIntent('bulk', h.deps); assert.equal(h.raw, saved); assert.equal(h.prepares, 1);
});
test('real cash adapter reload retains request IDs and does not refresh a saved event', async () => {
  const driver = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).name.includes('driver');
  let raw = null, reads = 0; const posts = [];
  global.window = { localStorage: { getItem: () => raw, setItem: (_, v) => { raw = v; }, removeItem: () => { raw = null; } }, confirm: () => true };
  Object.defineProperty(global, 'navigator', { configurable: true, value: { locks: { request: async (_, opts, callback) => callback({}) } } });
  const mocks = {
    './cash-intent': core, './auth': { getUser: () => driver ? Promise.resolve(user) : user },
    './api': { api: {
      get: async () => { reads++; return { data: { cashCollections: [{ kind: 'cod', status: 'held', events: [{ id: '11111111-1111-1111-1111-111111111111', createdAt: '2026-01-01' }] }] } }; },
      post: async (...args) => { posts.push(args); if (posts.length === 1) throw new Error('timeout'); return { data: { success: true } }; },
    } },
    'expo-secure-store': { getItemAsync: async () => raw, setItemAsync: async (_, v) => { raw = v; }, deleteItemAsync: async () => { raw = null; } },
    'react-native': { Platform: { OS: 'ios' }, Alert: { alert: (_, message, buttons) => buttons[1].onPress() } },
  };
  const execute = () => { const adapter = load('cash', mocks); return driver ? adapter.collectCash({ orderId: 'order-a', kind: 'cod' }) : adapter.mutateCash('handoff', [{ orderId: 'order-a', kind: 'cod' }], { toHolderType: 'driver', toDriverId: 'driver-a' }); };
  await assert.rejects(execute(), /uncertain/); assert.ok(raw);
  await execute(); assert.deepEqual(posts[0], posts[1]); assert.equal(reads, driver ? 0 : 1); assert.equal(raw, null);
});
test('actual HTTP interceptor denies switched context and never refresh-replays cash', async () => {
  const driver = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).name.includes('driver');
  const clients = []; let refreshCalls = 0;
  global.window = { location: { protocol: 'http:', hostname: 'localhost', pathname: '/', search: '', replace: () => {} } };
  const axios = { create: () => { const client = { interceptors: { request: { use: fn => { client.requestGuard = fn; } }, response: { use: (_, fn) => { client.errorGuard = fn; } } }, post: async () => { refreshCalls++; }, request: async () => { throw new Error('Must not replay'); } }; clients.push(client); return client; } };
  load('api', { axios: { default: axios }, './cash-intent': core,
    './auth': { getUser: () => driver ? Promise.resolve(user) : user, getToken: () => { const token = 'header.' + Buffer.from(JSON.stringify({ ...user, tokenType: 'access' })).toString('base64url') + '.signature'; return driver ? Promise.resolve(token) : token; }, getRefreshToken: () => { refreshCalls++; return null; } },
    'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } },
  });
  const config = { url: '/api/orders/order-a/cash/collect', headers: {}, cashContext: 'other-context' };
  await assert.rejects(async () => clients[0].requestGuard(config), /context changed/);
  const authorized = await clients[0].requestGuard({ ...config, headers: {}, cashContext: core.cashContext(user) }); assert.ok(authorized.headers.Authorization);
  const error = { response: { status: 401 }, config: { ...config, cashContext: core.cashContext(user) } };
  await assert.rejects(clients[0].errorGuard(error)); assert.equal(refreshCalls, 0);
});

test('token/user storage switching cannot send cash under another identity', () => {
  const token = claims => 'header.' + Buffer.from(JSON.stringify({ ...claims, tokenType: 'access' })).toString('base64url') + '.signature';
  const context = core.cashContext(user);
  core.assertCashToken(token(user), context);
  for (const field of ['id', 'tenantId', 'tenantMembershipId', 'companyId', 'companyMembershipId']) assert.throws(() => core.assertCashToken(token({ ...user, [field]: 'foreign' }), context), /disagree/);
  assert.throws(() => core.assertCashToken(null, context), /disagree/);
  assert.throws(() => core.assertCashToken('header.' + Buffer.from(JSON.stringify({ ...user, tokenType: 'refresh' })).toString('base64url') + '.signature', context), /disagree/);
});

test('retry rejection never clears an earlier uncertain operation', async () => {
 const h = harness(); h.error = new Error('timeout'); await assert.rejects(core.executeCashIntent('original', h.deps));
 const saved = h.raw;
 for (const status of [401, 403, 404, 409]) {
  h.error = { response: { status } }; await assert.rejects(core.executeCashIntent('original', h.deps), /earlier cash outcome remains uncertain/);
  assert.equal(h.raw, saved); assert.deepEqual(h.calls.at(-1).body, h.calls[0].body);
 }
 await assert.rejects(core.executeCashIntent('different', h.deps), /unresolved/); assert.equal(JSON.parse(h.raw).blocked, undefined);
});
test('concurrent client submissions create only one request', async () => {
 const driver = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).name.includes('driver');
 let raw = null, locked = false, release, entered; const started = new Promise(resolve => { entered = resolve; }); const wait = new Promise(resolve => { release = resolve; }); let posts = 0;
 global.window = { localStorage: { getItem: () => raw, setItem: (_, v) => { raw = v; }, removeItem: () => { raw = null; } }, confirm: () => true };
 Object.defineProperty(global, 'navigator', { configurable: true, value: { locks: { request: async (_, opts, callback) => { if (locked) return callback(null); locked = true; try { return await callback({}); } finally { locked = false; } } } } });
 const adapter = load('cash', {
  './cash-intent': core, './auth': { getUser: () => driver ? Promise.resolve(user) : user },
  './api': { api: { post: async () => { posts++; assert.ok(raw); entered(); await wait; return { data: { success: true } }; } } },
  'expo-secure-store': { getItemAsync: async () => raw, setItemAsync: async (_, v) => { raw = v; }, deleteItemAsync: async () => { raw = null; } },
  'react-native': { Platform: { OS: 'ios' }, Alert: { alert: () => { throw new Error('No replay'); } } },
 });
 const execute = () => driver ? adapter.collectCash({ orderId: 'order-a', kind: 'cod' }) : adapter.mutateCash('collect', [{ orderId: 'order-a', kind: 'cod' }]);
 const first = execute(); await started; await assert.rejects(execute(), /in progress/); release(); await first; assert.equal(posts, 1);
});
