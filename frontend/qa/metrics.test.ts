import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueWeek } from '../src/utils/analytics.ts';
test('revenue week retains seven calendar days and zero-sale days across a year boundary', () => {
 const points = revenueWeek([{sale_date:'2025-12-31',total_amount:'125.50',quantity:1},{sale_date:'2026-01-02',total_amount:75,quantity:1}],new Date(2026,0,2));
 assert.equal(points.length,7);assert.equal(points[0].date,'2025-12-27');assert.equal(points[6].date,'2026-01-02');
 assert.equal(points.find(point=>point.date==='2025-12-31')?.amount,125.5);
 assert.equal(points.find(point=>point.date==='2026-01-01')?.amount,0);
 assert.equal(points.reduce((sum,point)=>sum+point.amount,0),200.5);
});
test('same month and day in a different year never inflates current revenue', () => {
 const points=revenueWeek([{sale_date:'2025-09-08',total_amount:9000,quantity:1},{sale_date:'2026-09-08',total_amount:40,quantity:1},{sale_date:'2026-09-09',total_amount:500,quantity:1}],new Date(2026,8,8));
 assert.equal(points.reduce((sum,point)=>sum+point.amount,0),40);
});
test('an empty sales history creates a truthful zero-revenue week', () => {
 const points=revenueWeek([],new Date(2026,8,8));
 assert.equal(points.length,7);assert.ok(points.every(point=>point.amount===0));
});
