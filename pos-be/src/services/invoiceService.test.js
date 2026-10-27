const test = require('node:test');
const assert = require('node:assert/strict');
const { jakartaDay, reserveInvoice, checkoutIdentity } = require('./invoiceService');
test('tanggal invoice berpindah pada tengah malam Jakarta', () => {
  assert.equal(jakartaDay(new Date('2026-10-26T16:59:59Z')), '20261026');
  assert.equal(jakartaDay(new Date('2026-10-26T17:00:00Z')), '20261027');
});
test('nomor invoice terpisah per terminal dan tanggal', async () => {
  const counters = new Map();
  const db = {
    invoiceTerminal: { upsert: async ({ where }) => ({ id: where.deviceKey.endsWith('a') ? 1 : 2, kind: 'WEB' }) },
    invoiceCounter: { upsert: async ({ where }) => {
      const lastNumber = (counters.get(where.key) || 0) + 1; counters.set(where.key, lastNumber); return { lastNumber };
    } },
  };
  assert.match(await reserveInvoice(db, '123456789012345a'), /\/W01\/0001$/);
  assert.match(await reserveInvoice(db, '123456789012345a'), /\/W01\/0002$/);
  assert.match(await reserveInvoice(db, '123456789012345b'), /\/W02\/0001$/);
});
test('identitas checkout terikat pada kasir dan isi permintaan', () => {
  const req = { user: { id: 1 }, body: { items: [{ productId: 2, qty: 1 }] }, get: () => '1234567890123456' };
  const first = checkoutIdentity(req);
  assert.deepEqual(checkoutIdentity(req), first);
  req.body.items[0].qty = 2;
  assert.notEqual(checkoutIdentity(req).fingerprint, first.fingerprint);
  assert.throws(() => checkoutIdentity({ ...req, get: () => 'bad' }), /tidak valid/);
});
