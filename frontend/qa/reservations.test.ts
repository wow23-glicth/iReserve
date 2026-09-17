import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatReservationNumber,
  getAggregateStatus,
  groupReservationLines,
  type ReservationLineRecord
} from '../src/utils/reservations.ts';

test('formatReservationNumber formats clean reference codes', () => {
  const code = formatReservationNumber('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '2026-09-17');
  assert.equal(code, 'PJP-RES-20260917-A1B2C3D4E5F6');

  const legacy = formatReservationNumber('legacy-42', '2026-09-17', 42);
  assert.equal(legacy, 'PJP-RES-20260917-L42');
});

test('getAggregateStatus calculates status across line items', () => {
  const makeLine = (status: string): ReservationLineRecord => ({
    reservation_id: 1,
    transaction_id: 'tx-1',
    customer_id: 1,
    customer_name: 'Jane Doe',
    product_id: 1,
    product_name: 'Wire',
    unit: 'roll',
    price: 100,
    quantity: 2,
    reservation_date: '2026-09-17',
    created_at: '2026-09-17T10:00:00Z',
    status
  });

  assert.equal(getAggregateStatus([makeLine('Pending'), makeLine('Pending')]), 'Pending');
  assert.equal(getAggregateStatus([makeLine('Approved'), makeLine('Approved')]), 'Approved');
  assert.equal(getAggregateStatus([makeLine('Claimed'), makeLine('Claimed')]), 'Claimed');
  assert.equal(getAggregateStatus([makeLine('Pending'), makeLine('Approved')]), 'Pending');
});

test('groupReservationLines groups multiple items under one transaction', () => {
  const lines: ReservationLineRecord[] = [
    {
      reservation_id: 10,
      transaction_id: 'tx-group-1',
      customer_id: 5,
      customer_name: 'John Doe',
      product_id: 1,
      product_name: 'PVC Pipe',
      unit: 'pcs',
      price: 50,
      quantity: 3,
      reservation_date: '2026-09-17',
      created_at: '2026-09-17T10:00:00Z',
      status: 'Pending'
    },
    {
      reservation_id: 11,
      transaction_id: 'tx-group-1',
      customer_id: 5,
      customer_name: 'John Doe',
      product_id: 2,
      product_name: 'Hammer',
      unit: 'pcs',
      price: 250,
      quantity: 1,
      reservation_date: '2026-09-17',
      created_at: '2026-09-17T10:00:00Z',
      status: 'Pending'
    },
    {
      reservation_id: 12,
      transaction_id: null,
      customer_id: 6,
      customer_name: 'Legacy Customer',
      product_id: 3,
      product_name: 'Nails',
      unit: 'kg',
      price: 80,
      quantity: 2,
      reservation_date: '2026-09-16',
      created_at: '2026-09-16T10:00:00Z',
      status: 'Approved'
    }
  ];

  const grouped = groupReservationLines(lines);
  assert.equal(grouped.length, 2);

  const tx1 = grouped.find(g => g.transaction_id === 'tx-group-1');
  assert.ok(tx1);
  assert.equal(tx1.items.length, 2);
  assert.equal(tx1.total_quantity, 4);
  assert.equal(tx1.total_amount, 50 * 3 + 250 * 1); // 400
  assert.equal(tx1.status, 'Pending');
  assert.equal(tx1.is_legacy, false);

  const legacyTx = grouped.find(g => g.is_legacy);
  assert.ok(legacyTx);
  assert.equal(legacyTx.items.length, 1);
  assert.equal(legacyTx.total_quantity, 2);
  assert.equal(legacyTx.total_amount, 160);
});
