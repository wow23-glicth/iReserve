
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const checks=[];
const out=path.resolve('../.impeccable/review');
const pass=name=>checks.push(name);
async function ready(p){await p.waitForFunction(()=>!document.querySelector('.animate-spin')); }
async function nav(p,label){if((await p.viewportSize()).width<=768)await p.getByRole('button',{name:'Open navigation',exact:true}).click();await p.locator('.sidebar').getByRole('button',{name:label,exact:true}).click();await ready(p);}
(async()=>{
 const b=await chromium.launch({headless:true,channel:'chrome'});
 const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const failures=[];p.on('pageerror',e=>failures.push(e.message));
 await p.goto('http://127.0.0.1:4173');await ready(p);
 await p.getByRole('button',{name:'Open navigation',exact:true}).click();
 await p.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Close navigation');
 await p.keyboard.press('Shift+Tab');assert.equal((await p.locator(':focus').innerText()).trim(),'Log out');
 await p.keyboard.press('Escape');assert.equal(await p.locator(':focus').getAttribute('aria-label'),'Open navigation');pass('Mobile navigation traps and restores focus; Escape dismisses');
 await nav(p,'Inventory');
 assert.equal(await p.locator('.inventory-table tbody tr').count(),10);
 await p.getByRole('button',{name:'Next page',exact:true}).click();assert.equal(await p.locator('.inventory-table tbody tr').count(),4);pass('Inventory pagination shows 10 then 4 products');
 await p.getByRole('combobox',{name:'Filter by stock'}).selectOption('low');
 await p.waitForFunction(()=>document.querySelector('.pagination')?.textContent.includes('1 of 1'));
 assert.equal(await p.locator('.inventory-table tbody tr').count(),3);pass('Stock filter resets pagination and excludes out-of-stock items');
 await p.getByRole('button',{name:'Edit Product',exact:true}).first().click();assert.equal(await p.locator(':focus').getAttribute('id'),'inventory-field-5');
 const dialog=p.getByRole('dialog');await dialog.getByRole('button',{name:'Save Changes'}).focus();await p.keyboard.press('Tab');assert.equal(await p.locator(':focus').getAttribute('aria-label'),'Close edit product dialog');
 await p.keyboard.press('Escape');assert.equal(await p.getByRole('dialog').count(),0);pass('Edit modal focuses input, traps Tab, and dismisses on Escape');
 await p.getByRole('button',{name:'Delete Product',exact:true}).first().click();assert.equal(await p.getByRole('dialog').count(),1);await p.getByRole('button',{name:'Cancel',exact:true}).click();pass('Destructive inventory action requires a dismissible confirmation');
 const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'Export Excel',exact:true}).click();const download=await downloadPromise;const file=path.join(out,'inventory-export.xlsx');await download.saveAs(file);assert.equal(fs.readFileSync(file).subarray(0,2).toString(),'PK');pass('Inventory export produces a real XLSX archive');
 for(const label of ['Sales','Reservations']){
  await nav(p,label);await p.locator('.action-panel summary').click();await p.getByLabel('Customer Name',{exact:true}).fill('QA Customer');
  const combo=p.getByRole('combobox',{name:'Search & Select Product'});
  await combo.fill('');await combo.focus();await combo.press('ArrowUp');
  const enabledOptions=p.locator('[role="option"][aria-disabled="false"]');
  assert.equal(await combo.getAttribute('aria-activedescendant'),await enabledOptions.last().getAttribute('id'));
  await combo.press('ArrowDown');assert.equal(await combo.getAttribute('aria-activedescendant'),await enabledOptions.first().getAttribute('id'));
  await combo.press('ArrowUp');assert.equal(await combo.getAttribute('aria-activedescendant'),await enabledOptions.last().getAttribute('id'));
  await combo.press('Escape');pass(label+' picker starts ArrowUp at the final available product and wraps both directions');
  await combo.fill('PVC');await combo.press('ArrowDown');assert.ok(await combo.getAttribute('aria-activedescendant'));await combo.press('Enter');assert.equal(await combo.getAttribute('aria-expanded'),'false');
  await p.getByLabel('Quantity',{exact:true}).fill('1');await p.getByRole('button',{name:'Add to cart',exact:true}).click();assert.equal(await p.locator('.cart-table tbody tr').count(),1);
  await combo.fill('Paint');await combo.press('ArrowDown');await combo.press('Enter');await p.getByRole('button',{name:'Add to cart',exact:true}).click();assert.equal(await p.locator('.cart-table tbody tr').count(),2);
  await p.getByRole('button',{name:'Remove item',exact:true}).first().click();assert.equal(await p.locator('.cart-table tbody tr').count(),1);
  pass(label+' picker supports keyboard selection and multi-item cart add/remove');
 }
 await nav(p,'Sales');
 const grouped=p.locator('.sales-table tbody tr').filter({has:p.locator('.sale-line-items li:nth-child(2)')}).first();await grouped.getByRole('button',{name:/Open printable receipt/}).click();
 assert.equal(await p.locator('.receipt-items tbody tr').count(),2);pass('Grouped sale opens one receipt with both product lines');
 await p.getByRole('button',{name:'Print Receipt'}).focus();await p.keyboard.press('Tab');assert.equal((await p.locator(':focus').innerText()).trim(),'Close');pass('Receipt keyboard focus remains inside the dialog');
 await p.emulateMedia({media:'print'});assert.equal(await p.locator('#root').evaluate(el=>getComputedStyle(el).display),'none');assert.equal(await p.locator('.receipt-screen-actions').evaluate(el=>getComputedStyle(el).display),'none');
 await p.pdf({path:path.join(out,'receipt-print.pdf'),width:'95mm',height:'160mm',printBackground:true});pass('Print layout shows receipt only and hides workspace and controls');
 await p.emulateMedia({media:'screen'});await p.keyboard.press('Escape');
 await p.close();
 for(const role of ['Cashier','Manager']){
  const r=await b.newPage({viewport:{width:1280,height:900}});await r.goto('http://127.0.0.1:4173/?role='+role);await ready(r);
  assert.equal(await r.locator('.sidebar').getByRole('button',{name:'User Settings',exact:true}).count(),0);
  assert.equal(await r.locator('.sidebar').getByRole('button',{name:'Inventory',exact:true}).count(),role==='Cashier'?0:1);
  await nav(r,'Reservations');assert.equal(await r.getByRole('button',{name:'Approve',exact:true}).count()>0,role==='Manager');
  await nav(r,'Sales');assert.equal(await r.getByRole('button',{name:'Delete All History',exact:true}).count(),0);
  await r.close();pass(role+' UI preserves navigation and action permissions');
 }
 const normal=await b.newPage();await normal.goto('http://127.0.0.1:4174');await normal.getByRole('heading',{name:'Log in to your workspace'}).waitFor();assert.match(await normal.locator('body').innerText(),/Workspace connection is not configured/);assert.equal(await normal.getByRole('button',{name:'Log in',exact:true}).isDisabled(),true);pass('Unconfigured normal app renders setup feedback without attempting sign-in');await normal.close();
 assert.deepEqual(failures,[]);pass('No JavaScript page errors during interaction checks');
 await b.close();fs.writeFileSync(path.join(out,'interactions.json'),JSON.stringify({checks,errors:failures},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
})().catch(e=>{fs.writeFileSync(path.join(out,'interactions.json'),JSON.stringify({checks,failure:e.message},null,2));console.error(e);process.exit(1)});
