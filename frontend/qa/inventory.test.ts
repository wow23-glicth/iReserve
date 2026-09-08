import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStockInput,parseStockInput,availableStock,stockQuantity,stockNeedsReview} from '../src/utils/stock.ts';
import {saveWithProductPhoto,ProductSaveError,validateProductPhoto,MAX_PRODUCT_PHOTO_BYTES} from '../src/utils/productPhotos.ts';

test('negative input normalizes immediately and cannot reach the write payload', () => {
  for (const value of ['-1','-20','-0.5','-1e3']) { assert.equal(normalizeStockInput(value),'0'); assert.equal(parseStockInput(value),0); }
  assert.equal(normalizeStockInput(''),''); assert.equal(parseStockInput('12'),12);
  for (const value of ['', 'abc', '1.5', 'Infinity', '2147483648']) assert.throws(() => parseStockInput(value));
});
test('negative, over-reserved, and invalid records never expose sellable stock', () => {
  for (const [stock,reserved] of [[-1,0],[0,1],[5,6],[5,-1],['invalid',0]]) {
    assert.equal(availableStock(stock,reserved),0); assert.equal(stockNeedsReview(stock,reserved),true);
  }
  assert.equal(stockQuantity(-1),0); assert.equal(availableStock(8,3),5); assert.equal(stockNeedsReview(8,3),false);
});
test('photos accept supported types within the size limit', () => {
  for (const type of ['image/jpeg','image/png','image/webp']) validateProductPhoto({type,size:1024});
  for (const value of [{type:'image/svg+xml',size:100},{type:'image/png',size:0},{type:'image/png',size:MAX_PRODUCT_PHOTO_BYTES+1}]) assert.throws(()=>validateProductPhoto(value));
});
const photo = new File(['test content'],'photo.png',{type:'image/png'});
const base = () => { const events: string[] = []; return {events,storage:{upload:async()=>{events.push('upload');return 'new.png';},remove:async(path:string)=>{events.push('remove:'+path);}},save:async(path:string|null|undefined)=>{events.push('save:'+path);}}; };
test('omitting a photo leaves existing metadata untouched and needs no storage', async () => {
  const context=base(); await saveWithProductPhoto({...context,file:null,currentPath:'old.png',removePhoto:false});
  assert.deepEqual(context.events,['save:undefined']);
});
test('replacement saves its persistent path before removing the old object', async () => {
  const context=base(); await saveWithProductPhoto({...context,file:photo,currentPath:'old.png',removePhoto:false});
  assert.deepEqual(context.events,['upload','save:new.png','remove:old.png']);
});
test('removal clears metadata before deleting the object', async () => {
  const context=base(); await saveWithProductPhoto({...context,file:null,currentPath:'old.png',removePhoto:true});
  assert.deepEqual(context.events,['save:null','remove:old.png']);
});
test('upload failure never saves a product', async () => {
  const context=base(); context.storage.upload=async()=>{throw new Error('upload failed');};
  await assert.rejects(saveWithProductPhoto({...context,file:photo,currentPath:null,removePhoto:false}),/upload failed/);
  assert.deepEqual(context.events,[]);
});
test('confirmed rejected save cleans up only the new object and preserves the old photo', async () => {
  const context=base(); context.save=async()=>{throw new ProductSaveError('rejected',true);};
  await assert.rejects(saveWithProductPhoto({...context,file:photo,currentPath:'old.png',removePhoto:false}),/rejected/);
  assert.deepEqual(context.events,['upload','remove:new.png']);
});
test('unknown write outcome keeps the uploaded object for recovery', async () => {
  const context=base(); context.save=async()=>{throw new Error('connection lost');};
  await assert.rejects(saveWithProductPhoto({...context,file:photo,currentPath:'old.png',removePhoto:false}),/could not be confirmed/);
  assert.deepEqual(context.events,['upload']);
});
test('cleanup failure after a successful save is a warning, not a failed product save', async () => {
  const context=base(); context.storage.remove=async()=>{throw new Error('cleanup failed');};
  assert.equal(await saveWithProductPhoto({...context,file:photo,currentPath:'old.png',removePhoto:false}),true);
  assert.deepEqual(context.events,['upload','save:new.png']);
});
