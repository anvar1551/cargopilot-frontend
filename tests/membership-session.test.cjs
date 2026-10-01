const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const driver = require('../package.json').name.includes('driver');
const root = path.join(__dirname, '..', 'lib');
const user = { id: 'u-a', name: 'Synthetic', email: 'synthetic@example.invalid', role: 'driver', tenantId: 't-a', tenantMembershipId: 'tm-a', companyId: 'c-a', companyMembershipId: 'cm-a', membershipId: 'cm-a', permissionCodes: ['drivers.telemetry'] };
const other = { ...user, tenantId: 't-b', tenantMembershipId: 'tm-b', companyId: 'c-b', companyMembershipId: 'cm-b', membershipId: 'cm-b' };
const response = (u = user) => ({ user: u, refreshToken: 'synthetic-refresh', token: 'header.' + Buffer.from(JSON.stringify({ ...u, tokenType: 'access', exp: 4102444800 })).toString('base64url') + '.synthetic' });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
function harness() {
  const store = new Map(), cache = new Map(); let fail = false;
  const secure = { getItemAsync: async k => store.get(k) ?? null, setItemAsync: async (k,v) => { if (fail) throw Error('synthetic storage failure'); store.set(k,v); }, deleteItemAsync: async k => { if (fail) throw Error('synthetic storage failure'); store.delete(k); } };
  global.window = { crypto: require('node:crypto').webcrypto, atob: global.atob, location: { protocol: 'http:', hostname:'localhost', pathname:'/login', search:'', replace() {} }, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k,v) => { if (fail) throw Error('storage'); store.set(k,v); }, removeItem: k => { if (fail) throw Error('storage'); store.delete(k); } } };
  const base = { 'expo-secure-store': secure, 'expo-local-authentication': {}, 'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'ios' } } };
  function load(file, extra = {}) {
    if (!Object.keys(extra).length && cache.has(file)) return cache.get(file);
    const filename = path.join(root,file+'.ts'); const mod = new Module(filename,module); mod.paths=module.paths;
    mod.require = name => Object.hasOwn(extra,name) ? extra[name] : Object.hasOwn(base,name) ? base[name] : name.startsWith('./') ? load(name.slice(2)) : name.startsWith('@/lib/') ? load(name.slice(6)) : require(name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020} }).outputText,filename);
    if (!Object.keys(extra).length) cache.set(file,mod.exports); return mod.exports;
  }
  const auth=load('auth');
  const save = (value=response(), options={}) => driver ? auth.setAuthSession({...value,...options}) : auth.saveAuth(value.token,value.user,{refreshToken:value.refreshToken,...options});
  const logout = () => driver ? auth.logout() : auth.clearAuth();
  return {store, secure, load, auth, save, logout, set fail(v){fail=v;}};
}
function apiHarness(h) {
  const clients=[];let refreshed;
  const axios={create(){const c={interceptors:{request:{use(fn){c.requestGuard=fn;}},response:{use(ok,bad){c.ok=ok;c.bad=bad;}}},post:async()=>{throw Error('No mocked refresh configured');},request:async config=>({config,data:{}})};clients.push(c);return c;}};
  const api=h.load('api',{axios:{default:axios}});
  const refresh=driver?clients[0]:clients[1]; refresh.post=async()=>({data:typeof refreshed==='function'?await refreshed():refreshed});
  return {api,client:clients[0],set refreshed(v){refreshed=v;}};
}
test('single eligible login sends credentials without a selector',async()=>{const h=harness(),core=h.load('session-contract');let body;const result=await core.requestLogin(async(p,b)=>{assert.equal(p,'/api/auth/login');body=b;return {data:response()};},{email:' synthetic@example.invalid ',password:'transient'},[]);assert.equal(body.companyMembershipId,undefined);assert.equal(result.session.user.companyMembershipId,'cm-a');assert.equal(h.store.size,0);});
test('verified 409 projects only server choices and persists no session',async()=>{const h=harness(),core=h.load('session-contract');const result=await core.requestLogin(async()=>{throw {response:{status:409,data:{code:'MEMBERSHIP_SELECTION_REQUIRED',memberships:[{companyMembershipId:'cm-a',companyName:'Synthetic company',tenantName:'Synthetic tenant',secret:'not projected'}]}}};},{email:'e',password:'transient'},[]);assert.equal(result.session,null);assert.deepEqual(Object.keys(result.choices[0]),['companyMembershipId','companyName','tenantName']);assert.equal(await h.auth.getToken(),null);assert.equal(h.store.size,0);});
test('selected login resubmits only an eligible companyMembershipId',async()=>{const h=harness(),core=h.load('session-contract');const choices=[{companyMembershipId:'cm-a',companyName:'A',tenantName:'A'}];let calls=0;const post=async(p,b)=>{calls++;assert.equal(b.companyMembershipId,'cm-a');assert.equal(b.membershipId,undefined);return {data:response()};};await core.requestLogin(post,{email:'e',password:'transient'},choices,'cm-a');await assert.rejects(core.requestLogin(post,{email:'e',password:'transient'},choices,'foreign'));assert.equal(calls,1);});
test('invalid credentials disclose no choices or password-bearing exception',async()=>{const h=harness(),core=h.load('session-contract');await assert.rejects(core.requestLogin(async()=>{throw {config:{data:{password:'transient'}},response:{status:401,data:{memberships:[user]}}};},{email:'e',password:'transient'},[]),e=>!e.message.includes('transient')&&!e.config);assert.equal(h.store.size,0);});
test('selection failure and mismatched selected response cannot establish a session',async()=>{const h=harness(),core=h.load('session-contract'),choices=[{companyMembershipId:'cm-a',companyName:'A',tenantName:'A'}];for(const result of [()=>Promise.reject({response:{status:403}}),()=>Promise.resolve({data:response(other)})]) await assert.rejects(core.requestLogin(result,{email:'e',password:'transient'},choices,'cm-a'));assert.equal(h.store.size,0);});
test('partial or duplicate choice data is rejected',()=>{const h=harness(),core=h.load('session-contract');assert.throws(()=>core.membershipChoices({response:{status:409,data:{code:'MEMBERSHIP_SELECTION_REQUIRED',memberships:[{companyMembershipId:'cm-a'}]}}}));assert.equal(core.membershipChoices({response:{status:403,data:{code:'MEMBERSHIP_SELECTION_REQUIRED',memberships:[user]}}}),null);});
test('one atomic session preserves all selected identity fields across restart',async()=>{const h=harness();await h.save();assert.equal(h.store.size,1);for(const k of ['tenantId','tenantMembershipId','companyId','companyMembershipId','membershipId'])assert.equal((await h.auth.getUser())[k],user[k]);const restarted = h.load('auth', { reload: true }); assert.equal((await restarted.getUser()).companyMembershipId, 'cm-a'); const source=[...h.store.values()][0];assert.ok(!source.includes('password'));h.store.set('cargopilot_cash_intent_v1','original-cash');await h.logout();assert.equal(h.store.get('cargopilot_cash_intent_v1'),'original-cash');assert.equal(await h.auth.getToken(),null);});
test('legacy unbound storage and forged mismatched access context fail closed',async()=>{const h=harness();h.store.set(driver?'cargopilot_token':'token',response().token);assert.equal(await h.auth.getToken(),null);await assert.rejects(async()=>h.save({...response(),token:response(other).token}));assert.equal(await h.auth.getToken(),null);});
test('storage failure cannot complete login',async()=>{const h=harness();h.fail=true;await assert.rejects(async()=>h.save(),/storage unavailable/);assert.equal(await h.auth.getToken(),null);});
test('late login persistence cannot resurrect logout or replace new selection',async()=>{const h=harness();const old=h.auth.authEpoch();await h.logout();await h.save(response(other));await assert.rejects(async()=>h.save(response(),{expectedEpoch:old}),/Session changed/);assert.equal((await h.auth.getUser()).tenantId,'t-b');});
test('actual refresh preserves context and rejects mismatch without replay',async()=>{for(const mismatch of [false,true]){const h=harness();await h.save();const net=apiHarness(h);net.refreshed=response(mismatch?other:user);const config=await net.client.requestGuard({url:'/api/orders',headers:{}});const error={response:{status:401},config};try{await net.client.bad(error);}catch{}assert.equal(await h.auth.getToken(),mismatch?null:response().token);}});
test('late HTTP success/error cannot surface data or logout a newer session',async()=>{const h=harness();await h.save();const net=apiHarness(h);const config=await net.client.requestGuard({url:'/api/orders',headers:{}});await h.logout();await h.save(response(other));assert.throws(()=>net.client.ok({config,data:{private:'old'}}),/late response/);await assert.rejects(net.client.bad({config,response:{status:401}}),/late response/);assert.equal((await h.auth.getUser()).tenantId,'t-b');});
test('late refresh cannot restore an old session after a context change',async()=>{const h=harness();await h.save();const net=apiHarness(h),d=deferred();net.refreshed=()=>d.promise;const config=await net.client.requestGuard({url:'/api/orders',headers:{}});const pending=net.client.bad({config,response:{status:401}}).catch(()=>{});await new Promise(r=>setImmediate(r));await h.logout();await h.save(response(other));d.resolve(response());await pending;assert.equal((await h.auth.getUser()).companyMembershipId,'cm-b');});
test('missing bound context cannot start protected HTTP work',async()=>{const h=harness(),net=apiHarness(h);await assert.rejects(async()=>net.client.requestGuard({url:'/api/orders',headers:{}}),/Bound login/);});
test('pending cash intent survives logout and is suppressed under another membership',async()=>{const h=harness(),cash=h.load('cash-intent');await h.save();const context=cash.cashContext(await h.auth.getUser());const record=JSON.stringify({version:1,intent:'cash',context,path:'/api/orders/o/cash/collect',body:{operationId:'same-id'}});await h.logout();await h.save(response(other));let sends=0;await assert.rejects(cash.executeCashIntent('cash',{context:async()=>cash.cashContext(await h.auth.getUser()),read:async()=>record,write:async()=>{throw Error('Must preserve');},prepare:async()=>{throw Error('No replacement');},send:async()=>{sends++;},confirm:async()=>true}));assert.equal(sends,0);assert.equal(JSON.parse(record).body.operationId,'same-id');});
if(driver){
test('legacy proof sync has zero queue reads, storage changes or upload effects',async()=>{const h=harness();h.store.set('cargopilot_driver_order_proofs_v2','legacy-private-proof');await h.load('deliveryProofSync').syncDeliveryProofQueueOnce();assert.equal(h.store.get('cargopilot_driver_order_proofs_v2'),'legacy-private-proof');});
test('notification cache is partitioned and late server hydration is discarded',async()=>{const h=harness();await h.save();const page=deferred();let snapshot;const notifications=h.load('notifications',{'@/lib/api':{api:{get:async url=>url.includes('unread')?{data:{unreadCount:9}}:page.promise}},react:{useEffect(){},useSyncExternalStore(_s,get){snapshot=get();return snapshot;},useMemo(fn){return fn();}}});const pending=notifications.hydrateDriverNotifications();await new Promise(r=>setImmediate(r));await h.logout();await h.save(response(other));page.resolve({data:{items:[{id:'old',title:'Old private data',at:'2026-01-01',unread:true}]}});await pending;assert.equal(notifications.useDriverNotifications().items.length,0);});
test('legacy presence retry is not replayed into a new selected context',async()=>{const h=harness();await h.save(response(other));h.store.set('cargopilot_driver.live_location_pending','1');let puts=0;const presence=h.load('driverPresence',{'./api':{api:{get:async()=>({data:{presence:{enabled:false}}}),put:async()=>{puts++;}}}});assert.equal(await presence.syncDriverLiveLocationEnabledWithServer(),false);assert.equal(puts,0);});
test('actual realtime callbacks and authentication remain bound to their original session',async()=>{const h=harness();let sockets=0;const handlers={};let notificationCalls=0;const next={on:(k,v)=>{handlers[k]=v;},disconnect(){},removeAllListeners(){}};const realtime=h.load('driverRealtime',{'@/lib/api':{BASE_URL:'http://localhost',formatApiError:()=>''},'socket.io-client':{io:()=>{sockets++;return next;}},'@/lib/notifications':{addDriverNotification:()=>{notificationCalls++;},setDriverNotificationsUnreadCount(){},syncDriverNotificationsFromServer:async()=>{}}});await realtime.startDriverRealtime({invalidateQueries:async()=>{}});assert.equal(sockets,0);await h.save();await realtime.startDriverRealtime({invalidateQueries:async()=>{}});const old=handlers['driver:notification'];old({id:'a',title:'Authorized'});assert.equal(notificationCalls,1);await h.logout();await h.save(response(other));old({id:'b',title:'Old event'});assert.equal(notificationCalls,1);});
}

if (!driver) test('SSE rejects missing context and discards a late old-session stream', async () => {
 const h=harness();let fetches=0,deliveries=0;const pending=deferred();const original=global.fetch;
 global.fetch=async()=>{fetches++;return pending.promise;};
 try {const sse=h.load('sse', {'@/lib/api':{api:{defaults:{baseURL:'http://localhost'}},tryRefreshSession:async()=>false}});
 const unbound=sse.subscribeAuthenticatedSse({path:'/api/events',lastEventIdKey:'cursor',onEvent:()=>{deliveries++;}});assert.equal(fetches,0);unbound();
 await h.save(); const stop=sse.subscribeAuthenticatedSse({path:'/api/events',lastEventIdKey:'cursor',onEvent:()=>{deliveries++;}});assert.equal(fetches,1);
 await h.logout();await h.save(response(other));pending.resolve({ok:true,status:200,body:{getReader:()=>{throw Error('Old content must not be read');}}});await new Promise(r=>setImmediate(r));stop();assert.equal(deliveries,0);
 } finally {global.fetch=original;}
});

test('refresh rejects every identity-field change including another company in the same tenant',()=>{
 const h=harness(),core=h.load('session-contract'),expected=core.identityKey(user);
 for(const field of ['id','tenantId','tenantMembershipId','companyId','companyMembershipId']) {
   const changed={...user,[field]:'different'};if(field==='companyMembershipId')changed.membershipId='different';
   assert.throws(()=>core.validateSession(response(changed),expected),/context changed/);
 }
 assert.throws(()=>core.validateSession(response({...user,tenantMembershipId:null})),/tenant-bound/);
});
