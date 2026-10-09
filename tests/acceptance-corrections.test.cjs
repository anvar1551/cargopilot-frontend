/* eslint-disable @typescript-eslint/no-require-imports -- Offline installed TypeScript loader. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.join(__dirname,'..');
function load(file){const filename=path.join(root,file),m=new Module(filename,module);m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return m.exports;}
const c=load('lib/acceptance-corrections.ts');
const user={id:'synthetic',tenantId:'t',companyId:'c',companyMembershipId:'m',tenantMembershipId:'tm',permissionCodes:['customers.read','pricing.read','cash.custody.read']};
test('overview never equates absent invoice, cash, collection or settlement with prepaid',()=>{
 for(const order of [{},{invoice:{status:'paid'}},{paymentState:'paid'},{serviceChargePaidStatus:'paid'},{paymentType:'unexpected'}])assert.equal(c.overviewPaymentLabel(order),'Unknown');
 assert.equal(c.overviewPaymentLabel({paymentType:'CASH'}),'CASH · payment status unknown');
 assert.equal(c.overviewPaymentLabel({paymentType:'ONLINE'}),'ONLINE · payment status unknown');
});
test('pricing refresh uses the same admission as history and cannot refresh missing targets',()=>{
 assert.equal(c.pricingHistoryReady(true,'tariff',''),false);assert.equal(c.pricingHistoryReady(false,'policy',''),false);
 assert.equal(c.pricingHistoryReady(true,'tariff','owned'),true);assert.equal(c.pricingHistoryReady(true,'policy',''),true);
 const source=fs.readFileSync(path.join(root,'components/workspace/PricingConfigurationWorkspace.tsx'),'utf8');
 assert.match(source,/if \(pricingHistoryReady\(can\("pricing.read"\), tab, selected\)\) void history.refetch\(\)/);
});
test('valid permitted deep link preserves query and fragment; foreign workspace falls home',()=>{
 const link='/dashboard/manager/customers/owned?q=long%20name#addresses';
 assert.equal(c.postLoginDestination(user,link,'/dashboard/manager'),link);
 assert.equal(c.postLoginDestination(user,'/dashboard/driver','/dashboard/manager'),'/dashboard/manager');
 assert.equal(c.postLoginDestination(user,'/dashboard/manager/pricing','/dashboard/manager'),'/dashboard/manager/pricing');
 assert.equal(c.postLoginDestination({...user,permissionCodes:[]},link,'/dashboard/manager'),'/dashboard/manager');
});
test('new actor cannot inherit stale next, unbound context, or forged/external destination',()=>{
 for(const next of ['https://example.invalid','//example.invalid/dashboard/driver','/dashboard/manager/../driver','/dashboard/manager/%2e%2e/driver','/dashboard/manager/customers?companyId=foreign','/dashboard/manager/customers?companyId=c&companyId=foreign','/dashboard/manager/unknown','/dashboard/manager\\customers'])assert.equal(c.postLoginDestination(user,next,'/dashboard/manager'),'/dashboard/manager');
 assert.equal(c.postLoginDestination({...user,tenantId:null},'/dashboard/manager/pricing','/dashboard/manager'),'/dashboard/manager');
 assert.equal(c.postLoginDestination(user,'/dashboard/manager?order=owned','/dashboard/manager'),'/dashboard/manager');
 assert.equal(c.postLoginDestination({...user,permissionCodes:['shipment.view']},'/dashboard/manager?order=owned','/dashboard/manager'),'/dashboard/manager?order=owned');
});
test('warehouse actor rejects driver next; shared cash route needs its narrow read permission',()=>{
 assert.equal(c.postLoginDestination(user,'/dashboard/driver','/dashboard/warehouse'),'/dashboard/warehouse');
 assert.equal(c.postLoginDestination(user,'/dashboard/service-cash','/dashboard/warehouse'),'/dashboard/service-cash');
 assert.equal(c.postLoginDestination({...user,permissionCodes:[]},'/dashboard/service-cash','/dashboard/warehouse'),'/dashboard/warehouse');
});
test('both active-session and newly authenticated login redirects use the same resolver',()=>{
 const source=fs.readFileSync(path.join(root,'app/(auth)/login/page.tsx'),'utf8');assert.equal((source.match(/router.replace\(postLoginDestination\(/g)||[]).length,2);
});
test('all locales have cash/billing labels and readable missing-translation fallback',()=>{
 for(const locale of ['en','ru','uz']){const messages=load('lib/i18n/messages/'+locale+'.ts')[locale];for(const group of ['billing','billingDesc'])for(const key of ['cash','orderPreparation']){assert.equal(typeof messages.managerSidebar[group][key],'string');assert(messages.managerSidebar[group][key].length>0);}}
 assert.equal(c.navigationLabel('missing.key','missing.key','Readable label'),'Readable label');assert.equal(c.navigationLabel('Translated','missing.key','Fallback'),'Translated');
});
test('component table keeps exact amounts intact in a labelled keyboard-scrollable container',()=>{
 const source=fs.readFileSync(path.join(root,'components/workspace/OrderBillingWorkspace.tsx'),'utf8');
 assert.match(source,/tabIndex=\{0\}\s+aria-label="Exact price components"/);assert.match(source,/min-w-\[30rem\]/);assert.match(source,/whitespace-nowrap tabular-nums/);assert.match(source,/<th scope="col"/);assert(!source.includes('p-2 break-all'));
});
