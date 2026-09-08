const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('../.impeccable/review');
const checks = [], issues = [];
const captures = [];
const ready = p => p.waitForFunction(() => !document.querySelector('.animate-spin'));
async function inventory(p) {
  if (p.viewportSize().width <= 768) await p.getByRole('button', {name:'Open navigation',exact:true}).click();
  await p.locator('.sidebar').getByRole('button', {name:'Inventory',exact:true}).click();
  await ready(p);
}
async function fillProduct(p,name) {
  await p.getByRole('textbox',{name:'Search inventory by name or ID...'}).fill(name);
  await p.locator('.action-panel summary').click();
  await p.getByLabel('Product Name',{exact:true}).fill(name);
  await p.getByLabel('Unit Price (₱)',{exact:true}).fill('50');
  await p.getByLabel('Initial Stock',{exact:true}).fill('4');
}
async function imageReady(locator) { await locator.waitFor(); await locator.evaluate(img => img.complete ? Promise.resolve() : new Promise(resolve => {img.onload=resolve;img.onerror=resolve;})); assert.ok(await locator.evaluate(img => img.naturalWidth>0)); }
async function capture(p,name) {
  await p.evaluate(()=>document.fonts.ready); await p.evaluate(()=>window.scrollTo(0,0));
  const geometry = await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('.photo-picker-layout,.modal-content,.table-container')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+2).map(el=>el.className)}));
  if (geometry.scroll>geometry.width || geometry.wide.length) issues.push({name,geometry});
  const file=path.join(out,name+'.png'); await p.screenshot({path:file,fullPage:true});captures.push(file);
}
(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const p = await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
    p.on('pageerror', e => issues.push(e.message));
    await p.goto('http://127.0.0.1:4173/?state=stock-mismatch'); await ready(p);
    const negativeLeft = await p.locator('.low-stock-item .badge').allTextContents();
    if (negativeLeft.some(text => /^-/.test(text))) issues.push('Dashboard shows negative available stock: '+negativeLeft.join(', '));
    else checks.push('Dashboard floors negative available stock at zero');
    await capture(p,'inventory-dashboard-zero-desktop');
    await inventory(p); await p.locator('.action-panel summary').click();
    await p.getByLabel('Initial Stock', {exact:true}).fill('-3');
    const stockValue = await p.getByLabel('Initial Stock', {exact:true}).inputValue();
    if (stockValue !== '0') issues.push('Negative input remained '+stockValue+' instead of 0');
    else checks.push('Negative stock input immediately becomes zero');
    await p.getByLabel('Product Name',{exact:true}).fill('QA Zero Stock');
    await p.getByLabel('Unit Price (₱)',{exact:true}).fill('10');
    await p.getByRole('button',{name:'Add Product',exact:true}).click();
    await p.getByRole('status').filter({hasText:'Product added successfully.'}).waitFor(); await ready(p);
    await p.getByRole('textbox',{name:'Search inventory by name or ID...'}).fill('QA Zero Stock');
    assert.equal(await p.locator('[data-label="Available Stock"] strong').innerText(),'0');
    checks.push('Product saves with zero stock and no photo');
    await p.getByRole('button',{name:'Edit Product',exact:true}).click();
    await p.getByLabel('Total Stock',{exact:true}).fill('-9'); assert.equal(await p.getByLabel('Total Stock',{exact:true}).inputValue(),'0');
    await p.getByRole('button',{name:'Save Changes',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});await ready(p);
    checks.push('Negative edit stock becomes zero and saves');
    await p.getByRole('textbox',{name:'Search inventory by name or ID...'}).fill('PVC Coupling');
    await p.getByRole('button',{name:'Edit Product',exact:true}).click();await p.getByLabel('Total Stock',{exact:true}).fill('0');
    await p.getByRole('button',{name:'Save Changes',exact:true}).click();await p.getByRole('dialog').getByRole('alert').filter({hasText:'1 reserved units'}).waitFor();
    checks.push('Stock edit explains and blocks reducing stock below reserved units');
    await p.getByRole('button',{name:'Cancel',exact:true}).click();await capture(p,'inventory-stock-review-desktop');await p.close();

    for (const width of [1440,390,320]) {
      const q=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'});q.on('pageerror',e=>issues.push(e.message));
      await q.goto('http://127.0.0.1:4173/?state=photos');await ready(q);await inventory(q);
      const name='QA Optional Photo '+width;
      await fillProduct(q,name);
      const fileInput=q.getByLabel('Product photo (optional)',{exact:true});
      await fileInput.setInputFiles({name:'unsupported.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
      await q.getByRole('alert').filter({hasText:'Choose a JPG, PNG, or WebP'}).waitFor();
      await fileInput.setInputFiles({name:'oversized.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
      await q.getByRole('alert').filter({hasText:'smaller than 5 MB'}).waitFor();
      await fileInput.setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
      await q.getByRole('alert').filter({hasText:'could not be read as a photo'}).waitFor();
      checks.push(width+'px: rejects unsupported, oversized, and unreadable files');
      await fileInput.setInputFiles(path.resolve('public/hardware-workspace.png'));
      await imageReady(q.getByAltText('Product photo preview',{exact:true}));
      await capture(q,'inventory-photo-add-'+width);
      await q.getByRole('button',{name:'Add Product',exact:true}).click();
      await q.getByRole('status').filter({hasText:'Product added successfully.'}).waitFor();await ready(q);
      await q.locator('.action-panel summary').click();
      await q.getByRole('textbox',{name:'Search inventory by name or ID...'}).fill(name);
      await imageReady(q.getByAltText(name+' product photo',{exact:true}));
      await capture(q,'inventory-photo-saved-'+width);
      await q.getByRole('button',{name:'Edit Product',exact:true}).click();
      await imageReady(q.getByAltText('Product photo preview',{exact:true}));
      await q.getByRole('dialog').getByLabel('Product photo (optional)',{exact:true}).setInputFiles(path.resolve('public/logo2.png'));
      await q.getByRole('dialog').locator('.photo-file-name').filter({hasText:'logo2.png'}).waitFor();
      await imageReady(q.getByAltText('Product photo preview',{exact:true}));
      await capture(q,'inventory-photo-edit-'+width);
      await q.getByRole('button',{name:'Save Changes',exact:true}).click();await q.getByRole('dialog').waitFor({state:'hidden'});await ready(q);
      await imageReady(q.getByAltText(name+' product photo',{exact:true}));
      await q.getByRole('button',{name:'Edit Product',exact:true}).click();await imageReady(q.getByAltText('Product photo preview',{exact:true}));
      await q.getByRole('button',{name:'Remove photo',exact:true}).click();await q.getByRole('button',{name:'Save Changes',exact:true}).click();
      await q.getByRole('dialog').waitFor({state:'hidden'});await ready(q);
      assert.equal(await q.getByAltText(name+' product photo',{exact:true}).count(),0);
      checks.push(width+'px: add, persist thumbnail, reopen, replace, and remove optional photo');
      await q.close();
    }
    for (const scenario of ['photo-upload-error','photo-save-error','photo-missing-column']) {
      const q=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});q.on('pageerror',e=>issues.push(e.message));
      await q.goto('http://127.0.0.1:4173/?state='+scenario);await ready(q);await inventory(q);await fillProduct(q,'QA Failing Photo');
      await q.getByLabel('Product photo (optional)',{exact:true}).setInputFiles(path.resolve('public/logo2.png'));await imageReady(q.getByAltText('Product photo preview',{exact:true}));
      await q.getByRole('button',{name:'Add Product',exact:true}).click();await q.getByRole('alert').waitFor();
      assert.equal(await q.getByRole('status').filter({hasText:'Product added successfully.'}).count(),0);
      assert.equal(await q.getByLabel('Product Name',{exact:true}).inputValue(),'QA Failing Photo');
      await capture(q,'inventory-'+scenario);
      checks.push(scenario+': clear error, retained form, no false success');await q.close();
    }
    const missing=await browser.newPage({viewport:{width:390,height:900}});
    await missing.goto('http://127.0.0.1:4173/?state=photo-load-error');await ready(missing);await inventory(missing);
    await missing.getByRole('status').filter({hasText:'Some product photos could not be loaded'}).waitFor();
    assert.ok(await missing.locator('.inventory-table tbody tr').count()>0);checks.push('Photo retrieval failure preserves the inventory table');await missing.close();
    assert.deepEqual(issues, []);
    console.log(JSON.stringify({passed:checks.length,checks,issues,captures},null,2));
  } finally { await browser.close(); fs.mkdirSync(out,{recursive:true}); fs.writeFileSync(path.join(out,'inventory-feature.json'),JSON.stringify({checks,issues,captures},null,2)); }
})().catch(error => { issues.push(error.message); fs.writeFileSync(path.join(out,'inventory-feature.json'),JSON.stringify({checks,issues,captures},null,2)); console.error(error); process.exitCode = 1; });
