const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const ts = require('../pos-android/node_modules/typescript');
const fs = require('node:fs');
const Module = require('node:module');
const source = ts.transpileModule(fs.readFileSync('pos-android/src/services/checkoutStorage.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleUnderTest = new Module('checkoutStorage');
moduleUnderTest.require = () => ({ default: {} });
moduleUnderTest._compile(source, 'checkoutStorage.js');
const { saveCheckout } = moduleUnderTest.exports;
const fixture = () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT); CREATE TABLE transactions(id TEXT PRIMARY KEY, invoiceNumber TEXT UNIQUE, receiptJson TEXT, syncError TEXT); CREATE TABLE items(transactionId TEXT, qty INTEGER CHECK(qty > 0));');
  const result = rows => ({ rows: { length: rows.length, item: i => rows[i] } });
  const db = {
    executeSql: async (query, args) => [result(sql.prepare(query).all(...args))],
    transaction: async callback => {
      const queue = [];
      const tx = { executeSql: (query, args, success, error) => queue.push({ query, args, success, error }) };
      sql.exec('BEGIN');
      try {
        callback(tx);
        while (queue.length) {
          const { query, args, success, error } = queue.shift();
          let rows;
          try { rows = query.startsWith('SELECT') ? sql.prepare(query).all(...args) : (sql.prepare(query).run(...args), []); }
          catch (e) { error(tx, e); throw e; }
          success?.(tx, result(rows));
        }
        sql.exec('COMMIT');
      } catch (e) { sql.exec('ROLLBACK'); throw e; }
    },
  };
  return { sql, db };
};
const receipt = id => ({ id, createdAt: '2026-10-26T18:00:00Z', total: 23000, items: [{ name: 'Nasi', quantity: 1 }] });
const statements = (id, qty = 1) => [['INSERT INTO transactions(id, invoiceNumber) VALUES (?, ?)', [id, '']], ['INSERT INTO items VALUES (?, ?)', [id, qty]]];
test('nota, item dan counter rollback bersama ketika satu item gagal', async () => {
  const { db, sql } = fixture();
  await assert.rejects(saveCheckout(db, 'K01', statements('failed', -1), receipt('failed')));
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 0);
  const saved = await saveCheckout(db, 'K01', statements('ok'), receipt('ok'));
  assert.equal(saved.invoiceNumber, 'INV/20261027/K01/0001');
  assert.deepEqual(saved.items, receipt('ok').items);
  assert.equal((await saveCheckout(db, 'K01', statements('ok2'), receipt('ok2'))).invoiceNumber, 'INV/20261027/K01/0002');
  sql.close();
});
test('kegagalan checkout duplikat tidak menghabiskan nomor', async () => {
  const { db, sql } = fixture();
  await saveCheckout(db, 'K01', statements('one'), receipt('one'));
  const replay = await saveCheckout(db, 'K01', statements('one'), receipt('one'));
  assert.equal(replay.invoiceNumber, 'INV/20261027/K01/0001');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM items').get().n, 1);
  assert.equal((await saveCheckout(db, 'K01', statements('two'), receipt('two'))).invoiceNumber, 'INV/20261027/K01/0002');
  sql.close();
});
