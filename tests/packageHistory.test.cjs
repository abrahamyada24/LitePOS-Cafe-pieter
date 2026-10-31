const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const ts = require('../pos-android/node_modules/typescript');

const sqlModule = new Module('transactionItemSql');
sqlModule._compile(ts.transpileModule(fs.readFileSync('pos-android/src/utils/transactionItemSql.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, 'transactionItemSql.js');
const { transactionItemName, transactionItemJoins } = sqlModule.exports;
const reportSource = fs.readFileSync('pos-android/src/screens/ReportScreen.tsx', 'utf8');
const renderQuery = source => new Function('transactionItemName', 'transactionItemJoins', 'dateCondition', `return \`${source}\`;`)(transactionItemName, transactionItemJoins, '');
const detailQuery = renderQuery(reportSource.split('const loadTransactionDetails =')[1].match(/executeSql\(`([\s\S]*?)`, \[transactionId\]\)/)[1]);
const bestsellerQuery = renderQuery(reportSource.match(/\[bsRes\] = await db.executeSql\(`([\s\S]*?)`\)/)[1]);
const exportQuery = renderQuery(reportSource.split('const fetchExportData =')[1].match(/executeSql\(`([\s\S]*?)`\)/)[1]);

test('nama paket, rincian dan ekspor bertahan setelah jadwal lewat/katalog dihapus; rekap kas tetap utuh', () => {
  const db = new DatabaseSync(':memory:');
  // RN SQLite does not enable foreign_keys; legacy package IDs are text in productId.
  db.exec('PRAGMA foreign_keys=OFF');
  // Use the actual item schema, including the snapshot column and legacy pkg ID.
  db.exec(fs.readFileSync('pos-android/src/database/db.ts', 'utf8').match(/const queryTransactionItems = `([\s\S]*?)`/)[1]);
  db.exec(`CREATE TABLE products(id INTEGER PRIMARY KEY, name TEXT, isActive INTEGER, availabilityEndTime TEXT);
    CREATE TABLE packages(id INTEGER PRIMARY KEY, name TEXT, isActive INTEGER);
    CREATE TABLE customers(id INTEGER PRIMARY KEY, phone TEXT);
    CREATE TABLE transactions(id TEXT PRIMARY KEY, invoiceNumber TEXT, createdAt TEXT, grandTotal REAL, discountAmount REAL, paymentMethod TEXT, status TEXT, customerId INTEGER, customerName TEXT, orderType TEXT, tableName TEXT, preOrderDate TEXT, paymentStatus TEXT, paidAmount REAL, remainingAmount REAL, paidAt TEXT);
    INSERT INTO transactions VALUES('sale','INV/20261030/K01/0007','2026-10-30T04:17:31Z',46000,0,'CASH','COMPLETED',NULL,'cantika','TAKE_AWAY',NULL,NULL,'PAID',46000,0,'2026-10-30T04:17:31Z');
    INSERT INTO packages VALUES(1,'Makan Siang',1);
    INSERT INTO products VALUES(1,'Ayam Sambal Matah',1,'13:00');
    INSERT INTO transaction_items(transactionId,productId,quantity,price,productName) VALUES('sale','pkg-1',2,23000,'[Paket] Makan Siang');`);
  const verify = () => {
    assert.equal(db.prepare(detailQuery).get('sale').name, '[Paket] Makan Siang');
    const best = db.prepare(bestsellerQuery).get();
    assert.equal(best.name, '[Paket] Makan Siang');
    assert.equal(best.qty, 2);
    assert.equal(best.revenue, 46000);
    assert.equal(db.prepare(exportQuery).get().productName, '[Paket] Makan Siang');
    const dashboard = fs.readFileSync('pos-android/src/screens/DashboardScreen.tsx', 'utf8');
    const closingQuery = dashboard.match(/\[salesRes\] = await db.executeSql\(\s*`([\s\S]*?)`/)[1];
    assert.equal(db.prepare(closingQuery).get('2026-10-30T00:00:00Z').cashSales, 46000);
  };
  verify();
  db.exec("UPDATE products SET isActive=0; UPDATE packages SET isActive=0, name='Nama Baru';");
  verify();
  db.exec('DELETE FROM products; DELETE FROM packages;');
  verify();
  db.close();
});

test('invoice paket lama tanpa snapshot tetap mengambil nama paket meskipun nonaktif', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE transaction_items(transactionId TEXT, productId TEXT, productName TEXT, quantity INTEGER, price REAL, originalPrice REAL, discountAmount REAL, notes TEXT);
    CREATE TABLE products(id INTEGER, name TEXT);
    CREATE TABLE packages(id INTEGER, name TEXT, isActive INTEGER);
    INSERT INTO packages VALUES(1,'Makan Siang',0);
    INSERT INTO transaction_items VALUES('old','pkg-1',NULL,2,23000,23000,0,'Paket: Ayam x1, Tea x1');`);
  assert.equal(db.prepare(detailQuery).get('old').name, '[Paket] Makan Siang');
  db.close();
});
