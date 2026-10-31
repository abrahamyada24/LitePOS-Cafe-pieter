const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { calculateShiftSummary } = require('../pos-be/src/services/shiftSummaryService');
const { upsertAndroidPackage } = require('../pos-be/src/services/packageSyncService');

const fixture = (initialPackages = []) => {
  let state = { packages: structuredClone(initialPackages), transactions: [] };
  const product = { id: 6, androidId: 61, name: 'Ayam', costPrice: 10000 };
  const attachProducts = pkg => pkg && ({ ...pkg, items: pkg.items.map(item => ({ ...item, product })) });
  const db = {
    storeSetting: { findFirst: async () => null },
    user: { findUnique: async () => ({ name: 'Kasir' }) },
    shift: { findFirst: async () => null, findMany: async () => [] },
    expense: { findMany: async () => [] },
    loyaltyConfig: { findFirst: async () => null },
    product: { findUnique: async ({ where }) => (where.id === 6 || where.androidId === 61) ? product : null },
    package: {
      findUnique: async ({ where }) => attachProducts(state.packages.find(pkg => where.id !== undefined ? pkg.id === where.id : pkg.androidId === where.androidId)),
      create: async ({ data }) => {
        const pkg = { ...data, id: 7, items: data.items.create };
        state.packages.push(pkg);
        return attachProducts(pkg);
      },
      update: async ({ where, data }) => {
        if (data.name === 'Failwrite') throw new Error('Simulated database failure');
        const pkg = state.packages.find(pkg => pkg.id === where.id);
        Object.assign(pkg, data, { items: data.items?.create ?? pkg.items });
        return attachProducts(pkg);
      },
    },
    packageItem: { deleteMany: async ({ where }) => { state.packages.find(pkg => pkg.id === where.packageId).items = []; } },
    transaction: {
      findUnique: async ({ where }) => state.transactions.find(tx => tx.androidId === where.androidId),
      findMany: async () => state.transactions,
      create: async ({ data }) => {
        const row = { ...data, id: 20, items: data.items.create,
          payments: data.payments.create.map(payment => ({ ...payment, createdAt: new Date('2026-10-30T04:17:31Z') })),
        };
        state.transactions.push(row);
        return row;
      },
    },
    kitchenOrder: { create: async () => ({}) },
    $transaction: async callback => {
      const before = structuredClone(state);
      try { return await callback(db); } catch (error) { state = before; throw error; }
    },
  };
  const filename = path.resolve('pos-be/src/controllers/syncController.js');
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name === '@prisma/client' ? { PrismaClient: class { constructor() { return db; } } }
    : name === '../utils/orderQueue' ? { reserveQueue: async () => ({ queueNumber: 1 }) } : original(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  const push = async (body, role = 'OWNER') => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
    await mod.exports.pushLocalData({ user: { id: 1, role }, body, get: () => '2' }, res);
    assert.equal(res.statusCode, 200);
    return res.payload;
  };
  return { db, push, state: () => state };
};

const sale = serverPackageId => ({
  id: 'sale-0007', invoiceNumber: 'INV/20261030/K01/0007', grandTotal: 46000,
  createdAt: '2026-10-30T04:17:31Z', paymentStatus: 'PAID', paymentMethod: 'CASH',
  cashAmount: 50000, changeAmount: 4000,
  items: [{ productId: 'pkg-1', serverPackageId, quantity: 2, price: 23000 }],
});
const packagePayload = { id: 1, name: 'Makan Siang', price: 23000, isActive: 1,
  items: [{ productId: 61, serverProductId: 6, quantity: 1 }],
};
const webPackage = { id: 7, androidId: null, name: 'Makan Siang', price: 23000, items: [{ productId: 6, qty: 1 }] };

test('paket offline dan invoice dalam satu kiriman diterima langsung, kas Rp46.000, retry tidak menggandakan', async () => {
  const f = fixture();
  const body = { packages: [packagePayload], transactions: [sale()] };
  const result = await f.push(body);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.syncedIds.transactions, ['sale-0007']);
  assert.deepEqual(result.idMap.packages, [{ androidId: 1, serverId: 7 }]);
  const saved = f.state().transactions;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].items[0].productId, 6);
  assert.equal(saved[0].items[0].qty, 2);
  assert.equal(saved[0].grandTotal, 46000);
  assert.equal(calculateShiftSummary({ shift: { openingCash: 0 }, transactions: saved }).cashSales, 46000);
  assert.deepEqual((await f.push({ transactions: [sale(7)] })).warnings, []);
  assert.equal(f.state().transactions.length, 1);
});

test('paket web ID7 yang menjadi ID lokal1 dipetakan memakai serverPackageId', async () => {
  const f = fixture([webPackage]);
  const result = await f.push({ transactions: [sale(7)] }, 'CASHIER');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.syncedIds.transactions, ['sale-0007']);
  assert.equal(f.state().transactions[0].items[0].productId, 6);
});

test('dua baris paket seperti invoice 0007 diterima tanpa mengubah total, tunai, atau kembalian', async () => {
  const f = fixture([webPackage]);
  const transaction = sale(7);
  const line = { ...transaction.items[0], quantity: 1 };
  transaction.items = [line, { ...line }];
  const result = await f.push({ transactions: [transaction] }, 'CASHIER');
  assert.deepEqual(result.warnings, []);
  const saved = f.state().transactions[0];
  assert.equal(saved.items.length, 2);
  assert.equal(saved.items.reduce((total, item) => total + item.qty * item.price, 0), 46000);
  assert.equal(saved.payments[0].amount, 46000);
  assert.equal(saved.cashAmount, 50000);
  assert.equal(saved.changeAmount, 4000);
});

test('ID server eksplisit menang atas paket lain yang memiliki androidId sama', async () => {
  const f = fixture([webPackage, { id: 9, androidId: 1, name: 'Paket Lain', items: [{ productId: 99, qty: 1 }] }]);
  const result = await f.push({ transactions: [sale(7)] });
  assert.deepEqual(result.warnings, []);
  assert.equal(f.state().transactions[0].items[0].productId, 6);
});

test('paket server eksplisit yang hilang tidak boleh beralih diam-diam ke paket lain', async () => {
  const f = fixture([{ ...webPackage, androidId: 1 }]);
  const result = await f.push({ transactions: [sale(99)] });
  assert.equal(result.warnings[0].entity, 'transaction');
  assert.deepEqual(result.syncedIds.transactions, []);
  assert.equal(f.state().transactions.length, 0);
});

test('komponen tidak valid tidak meninggalkan header paket kosong atau mengakui invoice', async () => {
  const f = fixture();
  const result = await f.push({ packages: [{ ...packagePayload, items: [{ productId: 999 }] }], transactions: [sale()] });
  assert.equal(f.state().packages.length, 0);
  assert.equal(f.state().transactions.length, 0);
  assert.deepEqual(result.idMap.packages, []);
  assert.deepEqual(result.syncedIds.transactions, []);
  assert.deepEqual(result.warnings.map(warning => warning.entity), ['package', 'transaction']);
});

test('gagal mengganti paket mempertahankan header dan komponen lama bersama', async () => {
  const f = fixture([webPackage]);
  await assert.rejects(upsertAndroidPackage(f.db, { ...packagePayload, serverId: 7, name: 'Failwrite' }), /Simulated database failure/);
  assert.deepEqual(f.state().packages, [webPackage]);
});
