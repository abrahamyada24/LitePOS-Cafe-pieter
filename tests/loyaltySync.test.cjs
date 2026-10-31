const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { calculateShiftSummary } = require('../pos-be/src/services/shiftSummaryService');

const fixture = () => {
  const customer = { id: 8, points: 13 };
  const saved = [];
  const db = {
    storeSetting: { findFirst: async () => null },
    user: { findUnique: async () => ({ name: 'Kasir' }) },
    customer: {
      findUnique: async () => customer,
      update: async ({ data }) => Object.assign(customer, data),
    },
    loyaltyConfig: { findFirst: async () => ({ configVersion: 2, isActive: true, redemptionMode: 'FREE_PRODUCT', minRedemptionPoints: 10, multiplierAmount: 25000 }) },
    shift: { findFirst: async () => null, findMany: async () => [] },
    expense: { findMany: async () => [] },
    product: { findUnique: async () => ({ id: 1, name: 'Kopi', availabilityScheduleEnabled: true, availabilityEndTime: '13:00' }) },
    package: { findUnique: async () => ({ id: 1, name: 'Makan Siang', items: [{ productId: 1, qty: 1, product: { name: 'Kopi' } }] }) },
    kitchenOrder: { create: async () => ({}) },
    transaction: {
      findUnique: async ({ where }) => saved.find(tx => tx.androidId === where.androidId),
      findMany: async () => saved,
      create: async ({ data }) => {
        const row = { ...data, id: saved.length + 1,
          items: data.items.create.map(item => ({ ...item, product: { name: 'Kopi' } })),
          payments: data.payments.create.map(payment => ({ ...payment, createdAt: new Date('2026-10-30T04:00:00Z') })),
        };
        saved.push(row);
        return row;
      },
    },
    $transaction: async callback => callback(db),
  };
  const filename = path.resolve('pos-be/src/controllers/syncController.js');
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name === '@prisma/client' ? { PrismaClient: class { constructor() { return db; } } }
    : name === '../utils/orderQueue' ? { reserveQueue: async () => ({ queueNumber: 1 }) } : original(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } });
  const push = async transaction => {
    const res = response();
    await mod.exports.pushLocalData({ user: { id: 1, role: 'OWNER' }, body: { transactions: [transaction] }, get: () => '2' }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.warnings, []);
    assert.deepEqual(res.payload.syncedIds.transactions, [transaction.id]);
    return res.payload;
  };
  const history = async () => {
    const res = response();
    await mod.exports.getTransactionHistory({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    return res.payload.data.transactions;
  };
  return { customer, saved, push, history };
};

const sale = overrides => ({
  id: 'sale-1', invoiceNumber: 'INV/20261030/K01/0001', createdAt: '2026-10-30T04:00:00Z',
  customerServerId: 8, grandTotal: 0, discountAmount: 25000, paymentStatus: 'PAID', paymentMethod: 'QRIS',
  pointsRedeemed: 10, items: [{ serverProductId: 1, productId: 1, quantity: 1, price: 25000, loyaltyRewardQty: 1 }],
  ...overrides,
});

test('tukar 10 poin sampai Rp0: saldo 13 menjadi 3, history tetap LUNAS, retry tidak memotong dua kali', async () => {
  const f = fixture();
  await f.push(sale());
  assert.equal(f.customer.points, 3);
  assert.equal(f.saved[0].pointsRedeemed, 10);
  assert.equal(f.saved[0].pointsBalanceAfter, 3);
  assert.equal(f.saved[0].payments[0].paymentStatus, 'PAID');
  const [history] = await f.history();
  assert.equal(history.paymentStatus, 'PAID');
  assert.equal(history.remainingAmount, 0);
  assert.equal(history.pointsRedeemed, 10);
  await f.push(sale());
  assert.equal(f.saved.length, 1);
  assert.equal(f.customer.points, 3);
});

test('tukar poin sebagian tetap memotong saldo dan menghitung sisa pembayaran', async () => {
  const f = fixture();
  await f.push(sale({ grandTotal: 5000, discountAmount: 20000 }));
  assert.equal(f.customer.points, 3);
  const [history] = await f.history();
  assert.equal(history.paymentStatus, 'PAID');
  assert.equal(history.paidAmount, 5000);
});

test('diskon manual 100% tetap LUNAS tanpa memotong poin', async () => {
  const f = fixture();
  await f.push(sale({ pointsRedeemed: 0 }));
  assert.equal(f.customer.points, 13);
  assert.equal((await f.history())[0].paymentStatus, 'PAID');
});

test('preorder belum bayar dan DP tetap belum lunas', async () => {
  for (const paymentStatus of ['UNPAID', 'PARTIAL']) {
    const f = fixture();
    await f.push(sale({ grandTotal: 25000, pointsRedeemed: 0, preOrderDate: '2026-11-01', paymentStatus, paidAmount: paymentStatus === 'PARTIAL' ? 5000 : 0 }));
    assert.equal(f.customer.points, 13);
    assert.equal((await f.history())[0].paymentStatus, paymentStatus);
  }
});

test('paket tunai tetap masuk history dan total tutup kasir tanpa bergantung jam aktif produk', async () => {
  const f = fixture();
  await f.push(sale({ grandTotal: 46000, discountAmount: 0, pointsRedeemed: 0, paymentMethod: 'CASH', items: [{ productId: 'pkg-1', quantity: 2, price: 23000 }] }));
  assert.equal((await f.history())[0].grandTotal, 46000);
  const summary = calculateShiftSummary({ shift: { openingCash: 100000 }, transactions: f.saved });
  assert.equal(summary.cashSales, 46000);
  assert.equal(summary.expectedCash, 146000);
});
