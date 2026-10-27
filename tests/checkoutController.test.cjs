const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { checkoutIdentity } = require('../pos-be/src/services/invoiceService');
const loadController = db => {
  const filename = path.resolve('pos-be/src/controllers/transactionController.js');
  const mod = new Module(filename);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name === '@prisma/client' ? { PrismaClient: class { constructor() { return db; } } }
    : name === 'midtrans-client' ? { Snap: class {} } : original(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
};
const request = () => ({ user: { id: 1 }, body: { items: [{ productId: 1, qty: 1 }], payment: { type: 'CASH' } }, get: () => '1234567890123456' });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } });
test('retry checkout mengembalikan invoice yang sama tanpa mengulang stok/pembayaran', async () => {
  const req = request(); const identity = checkoutIdentity(req);
  const saved = { id: 3, invoiceNumber: 'INV/20261027/W01/0001', checkoutFingerprint: identity.fingerprint };
  const controller = loadController({ transaction: { findUnique: async () => saved }, $transaction: () => assert.fail('retry must not write') });
  const res = response(); await controller.createTransaction(req, res);
  assert.equal(res.payload.idempotentReplay, true);
  assert.equal(res.payload.data.invoiceNumber, saved.invoiceNumber);
});
test('kunci checkout tidak boleh dipakai ulang untuk keranjang berbeda', async () => {
  const controller = loadController({ transaction: { findUnique: async () => ({ checkoutFingerprint: 'different' }) } });
  const res = response(); await controller.createTransaction(request(), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
});
test('dua permintaan bersamaan dengan kunci sama membaca hasil pemenang', async () => {
  const req = request(); const identity = checkoutIdentity(req); let reads = 0;
  const saved = { id: 4, checkoutFingerprint: identity.fingerprint };
  const controller = loadController({ transaction: { findUnique: async () => ++reads === 1 ? null : saved }, $transaction: async () => { throw Object.assign(new Error('duplicate'), { code: 'P2002' }); } });
  const res = response(); await controller.createTransaction(req, res);
  assert.equal(res.payload.idempotentReplay, true); assert.equal(res.payload.data.id, 4);
});
test('order meja yang sudah dibayar tidak dapat dibuatkan transaksi kedua', async () => {
  const req = request(); req.body.sourceOrderCode = 'MEJA-1';
  const controller = loadController({ transaction: { findUnique: async () => null }, $transaction: async callback => callback({ transaction: { findUnique: async () => null }, kitchenOrder: { findUnique: async () => ({ transactionId: 9 }) } }) });
  const res = response(); await controller.createTransaction(req, res);
  assert.equal(res.statusCode, 400); assert.match(res.payload.message, /sudah memiliki transaksi/);
});
