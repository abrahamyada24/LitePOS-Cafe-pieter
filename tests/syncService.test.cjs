const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../pos-android/node_modules/typescript');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const rows = items => ({ rows: { length: items.length, item: i => items[i] } });
const loadSync = (api, db) => {
  const source = ts.transpileModule(fs.readFileSync('pos-android/src/services/syncService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = new Module('syncService');
  mod.require = name => name === './api' ? { default: api, isDeviceAssetUrl: () => false } : { getDBConnection: async () => db };
  mod._compile(source, 'syncService.js');
  return mod.exports.syncService;
};
test('history periode lama mengambil semua halaman dan mempertahankan filter', async () => {
  const calls = [];
  const sync = loadSync({ get: async (url, { params }) => {
    calls.push({ url, params });
    return { data: { success: true, data: { transactions: [], expenses: [], shifts: [] }, meta: { totalPages: 3 } } };
  } }, {});
  const result = await sync.syncTransactionHistory({ startDate: '2026-07-01', endDate: '2026-07-31' });
  assert.equal(result.success, true);
  assert.deepEqual(calls.map(call => call.params.page), [1, 2, 3]);
  assert(calls.every(call => call.params.startDate === '2026-07-01' && call.params.endDate === '2026-07-31'));
});
test('history baru menyimpan header dan item dalam satu batch atomik', async () => {
  let batch;
  const sync = loadSync({ get: async () => ({ data: { data: {
    transactions: [{ id: 'server-1', invoiceNumber: 'INV/20261027/W01/0001', grandTotal: 23000, items: [{ productId: 1, quantity: 1, price: 23000 }] }], expenses: [], shifts: [],
  } } }) }, { executeSql: async query => { assert(query.trim().startsWith('SELECT')); return [rows([])]; }, sqlBatch: async statements => { batch = statements; } });
  await sync.syncTransactionHistory();
  assert.equal(batch.length, 2);
  assert.match(batch[0][0], /INSERT INTO transactions/);
  assert.match(batch[1][0], /INSERT INTO transaction_items/);
});
test('data lokal yang belum tersinkron tidak ditimpa pembayaran dari history server', async () => {
  const updates = [];
  const sync = loadSync({ get: async () => ({ data: { data: {
    transactions: [{ id: 'one', invoiceNumber: 'INV-old', paymentStatus: 'UNPAID', preOrderConfirmed: true }], expenses: [], shifts: [],
  } } }) }, { executeSql: async (query, args) => {
    if (query.includes('SELECT id, preOrderConfirmed')) return [rows([{ id: 'one', preOrderConfirmed: 0, isSynced: 0 }])];
    updates.push({ query, args }); return [rows([])];
  } });
  await sync.syncTransactionHistory();
  assert.equal(updates.length, 1);
  assert.match(updates[0].query, /^UPDATE transactions SET preOrderConfirmed/);
});
test('partial sync hanya menandai invoice yang diakui server, kegagalan tetap diantrekan', async () => {
  const writes = [];
  const db = { executeSql: async (query, args = []) => {
    if (query.startsWith('UPDATE')) writes.push({ query, args });
    if (query.includes("key = 'sync_initialized'")) return [rows([{ value: 'true' }])];
    if (query.includes('SELECT t.*')) return [rows([{ id: 'accepted', invoiceNumber: 'one' }, { id: 'rejected', invoiceNumber: 'two' }])];
    return [rows([])];
  } };
  const sync = loadSync({ post: async () => ({ data: { success: true, syncedIds: { transactions: ['accepted'], expenses: [], shifts: [], stockReceipts: [] }, warnings: [{ entity: 'transaction', id: 'rejected', message: 'Produk tidak ditemukan' }] } }) }, db);
  const result = await sync.pushLocalData();
  assert.equal(result.success, true);
  const ack = writes.find(write => write.query.includes('SET isSynced = 1'));
  assert.deepEqual(ack.args, ['accepted']);
  assert(writes.some(write => write.query.includes('SET syncError = ?') && write.args[1] === 'rejected'));
});

test('push invoice paket membawa ID server dari join paket, bukan ID lokal', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE transaction_items(transactionId TEXT, productId TEXT, quantity INTEGER, price REAL);
    CREATE TABLE products(id INTEGER, serverId INTEGER);
    CREATE TABLE packages(id INTEGER, serverId INTEGER);
    INSERT INTO packages VALUES(1,7);
    INSERT INTO transaction_items VALUES('sale','pkg-1',2,23000);`);
  let payload;
  const db = { executeSql: async (query, args = []) => {
    if (query.includes("key = 'sync_initialized'")) return [rows([{ value: 'true' }])];
    if (query.includes('SELECT t.*')) return [rows([{ id: 'sale', invoiceNumber: 'INV/20261030/K01/0007' }])];
    if (query.includes('FROM transaction_items ti')) return [rows(sql.prepare(query).all(...args))];
    return [rows([])];
  } };
  const sync = loadSync({ post: async (_url, body) => {
    payload = body;
    return { data: { success: true, syncedIds: { transactions: ['sale'] } } };
  } }, db);
  assert.equal((await sync.pushLocalData()).success, true);
  assert.equal(payload.transactions[0].items[0].serverPackageId, 7);
  assert.equal(payload.transactions[0].items[0].productId, 'pkg-1');
  assert.equal(payload.transactions[0].items[0].packageServerId, undefined);
  sql.close();
});
