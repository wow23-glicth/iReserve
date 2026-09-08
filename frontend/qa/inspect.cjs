
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');
const out=path.resolve('../.impeccable/review');fs.mkdirSync(out,{recursive:true});
const routes=[['Dashboard','Dashboard'],['Inventory','Inventory Management'],['Sales','Sales Operations'],['Reservations','Reservation Management'],['Analytics','Business Analytics'],['User Settings','User Settings']];
const issues=[],results=[],errors=[];
async function audit(page,name){
 const result=await page.evaluate(()=>{
  const viewport=innerWidth;
  const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
  const overflow=[...document.querySelectorAll('.main-content *, .login-page *')].filter(el=>visible(el)&&!el.closest('thead')&&getComputedStyle(el).position!=='fixed').map(el=>({el,r:el.getBoundingClientRect()})).filter(({el,r})=>r.width>0&&(r.right>viewport+1||r.left< -1)&&!el.closest('.login-hero')).slice(0,10).map(({el,r})=>({tag:el.tagName,cls:el.className,text:el.textContent?.slice(0,40),left:r.left,right:r.right}));
  const structural=[...document.querySelectorAll('.table-container,.stat-card,.action-panel,.modal-content,.receipt-modal-shell')].filter(visible).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({cls:el.className,width:el.clientWidth,scroll:el.scrollWidth}));
  const unlabeled=[...document.querySelectorAll('input:not([type=hidden]),select')].filter(visible).filter(el=>!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).map(el=>el.outerHTML.slice(0,180));
  return {width:viewport,documentWidth:document.documentElement.scrollWidth,overflow,structural,unlabeled};
 });results.push({name,...result});if(result.documentWidth>result.width||result.overflow.length||result.structural.length||result.unlabeled.length)issues.push({name,...result});
}
async function ready(page){await page.waitForFunction(() => !document.querySelector('.animate-spin'), {timeout:15000}); await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))])); }
async function go(page,nav,title,width){
 if(width<=768) await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:nav,exact:true}).click();
 await page.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
 await ready(page);await page.evaluate(()=>window.scrollTo(0,0));
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel: 'chrome'});
 for(const width of [1440,390,320,768,1280]) {
  const page=await browser.newPage({viewport:{width,height:width>768?960:844},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');await page.getByRole('heading',{name:'Dashboard',exact:true,level:1}).waitFor();await ready(page);
  for(const [nav,title] of routes){
   if(nav!=='Dashboard') await go(page,nav,title,width);
   await audit(page,nav+'-'+width);console.log(nav+' '+width);
   if(width===1440||width===390) await page.screenshot({path:path.join(out,nav.toLowerCase().replaceAll(' ','-')+'-'+width+'.png')});
  }
  await page.close();
 }
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await page.goto('http://127.0.0.1:4173/?state=login');await page.getByRole('heading',{name:'Log in to your workspace'}).waitFor();await ready(page);
  await audit(page,'Login-'+width);if(width!==320)await page.screenshot({path:path.join(out,'login-'+width+'.png')});
  await page.getByLabel('Password',{exact:true}).fill('example');await page.getByRole('button',{name:'Show password',exact:true}).click();if(await page.getByLabel('Password',{exact:true}).getAttribute('type')!=='text')throw new Error('Password visibility failed');
  await page.getByLabel('Staff username or email').fill('admin');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('alert').waitFor();await page.getByLabel('Password',{exact:true}).fill('preview-pass');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('heading',{name:'Dashboard',exact:true,level:1}).waitFor();await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto('http://127.0.0.1:4173');await ready(page);
 for(const nav of ['Sales','Reservations']){
  await go(page,nav,nav==='Sales'?'Sales Operations':'Reservation Management',390);
  await page.locator('.action-panel summary').click();await page.getByLabel('Customer Name',{exact:true}).fill('Sample Customer With A Long Business Name');
  await page.getByLabel('Search & Select Product').fill('Paint');await page.getByRole('option',{name:/Paint Roller.*left/}).click();
  await page.getByLabel('Quantity',{exact:true}).fill('2');await page.getByRole('button',{name:/Add to (Sale|Reservation|Cart)/i}).click();
  await page.getByLabel('Search & Select Product').fill('PVC');await page.getByRole('option',{name:/PVC Electrical Conduit.*left/}).click();
  await page.getByRole('button',{name:/Add to (Sale|Reservation|Cart)/i}).click();
  await audit(page,nav+'-cart-390');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,nav.toLowerCase()+'-form-390.png'),fullPage:true});
 }
 await go(page,'Sales','Sales Operations',390);await page.getByRole('button',{name:/Open printable receipt/}).first().click();await page.getByRole('dialog').waitFor();await audit(page,'Receipt-390');await page.screenshot({path:path.join(out,'receipt-390.png')});await page.keyboard.press('Escape');if(await page.getByRole('dialog').count())throw new Error('Receipt escape failed');
 await go(page,'Inventory','Inventory Management',390);await page.getByRole('combobox',{name:'Filter by stock'}).selectOption('low');await audit(page,'Inventory-filter-390');
 await page.getByRole('button',{name:'Edit Product',exact:true}).first().click();await page.getByRole('dialog').waitFor();await audit(page,'Edit-inventory-390');await page.screenshot({path:path.join(out,'inventory-edit-390.png')});await page.getByRole('button',{name:'Close edit product dialog'}).click();
 await page.close();
 for(const scenario of ['empty','error']){
  const p=await browser.newPage({viewport:{width:1440,height:960}});await p.goto('http://127.0.0.1:4173/?state='+scenario);await ready(p);await audit(p,'Dashboard-'+scenario);await p.screenshot({path:path.join(out,'dashboard-'+scenario+'.png')});await p.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'audit-final.json'),JSON.stringify({results,issues,errors},null,2));console.log(JSON.stringify({screens:results.length,issues,errors},null,2));
})().catch(e=>{fs.writeFileSync(path.join(out,'audit-final.json'),JSON.stringify({results,issues,errors,failure:e.message},null,2));console.error(e);process.exit(1)});
