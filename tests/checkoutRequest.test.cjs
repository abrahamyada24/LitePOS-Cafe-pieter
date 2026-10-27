const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('checkout browser mempertahankan kunci setelah reload, menahan perubahan keranjang, dan memisahkan akun', async () => {
  const values = new Map();
  global.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const source = fs.readFileSync('pos-fe/src/utils/checkoutRequest.js', 'utf8');
  const first = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const payload = { userId: 1, items: [{ id: 1, qty: 2 }] };
  const checkout = first.prepareCheckoutRequest(payload);
  const afterReload = await import('data:text/javascript;base64,' + Buffer.from(source + '\n// reload').toString('base64'));
  assert.equal(afterReload.prepareCheckoutRequest(payload).key, checkout.key);
  assert.throws(() => first.prepareCheckoutRequest({ ...payload, items: [{ id: 2, qty: 1 }] }), /belum terkonfirmasi/);
  assert.equal(first.getPendingCheckout(2), null);
  assert.notEqual(first.prepareCheckoutRequest({ ...payload, userId: 2 }).key, checkout.key);
  first.finishCheckoutRequest(1);
  assert.equal(first.getPendingCheckout(1), null);
  assert(first.getPendingCheckout(2));
});
