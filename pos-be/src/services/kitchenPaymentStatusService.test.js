const test = require('node:test');
const assert = require('node:assert/strict');
const { getKitchenPaymentStatus } = require('./kitchenPaymentStatusService');

test('order tanpa transaksi berstatus belum dibayar', () => {
  assert.equal(getKitchenPaymentStatus(null), 'UNPAID');
});

test('transaksi manual yang lunas berstatus sudah dibayar', () => {
  assert.equal(getKitchenPaymentStatus({ status: 'PAID', payments: [] }), 'PAID');
});

test('transaksi gateway yang belum settlement berstatus menunggu bayar', () => {
  assert.equal(getKitchenPaymentStatus({ status: 'PENDING', payments: [{ paymentStatus: 'PENDING' }] }), 'PENDING');
});

test('settlement gateway tetap dikenali sebagai sudah dibayar', () => {
  assert.equal(getKitchenPaymentStatus({ status: 'PENDING', payments: [{ paymentStatus: 'SETTLEMENT' }] }), 'PAID');
});
