const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateShiftSummary } = require('./shiftSummaryService');

test('expected cash hanya menghitung pembayaran tunai dan mengurangi pengeluaran', () => {
    const summary = calculateShiftSummary({
        shift: { openingCash: 100000 },
        transactions: [
            { status: 'PAID', grandTotal: 50000, payments: [{ paymentType: 'CASH', amount: 50000 }] },
            { status: 'PAID', grandTotal: 75000, payments: [{ paymentType: 'QRIS', amount: 75000 }] },
            { status: 'COMPLETED', grandTotal: 25000, payments: [{ paymentType: 'TRANSFER', amount: 25000 }] },
            { status: 'RETURNED', grandTotal: 9000, payments: [{ paymentType: 'CASH', amount: 9000 }] },
        ],
        expenses: [{ amount: 10000 }],
        closingCash: 142000,
    });

    assert.equal(summary.totalSales, 150000);
    assert.equal(summary.cashSales, 50000);
    assert.equal(summary.qrisSales, 75000);
    assert.equal(summary.transferSales, 25000);
    assert.equal(summary.cashExpenses, 10000);
    assert.equal(summary.expectedCash, 140000);
    assert.equal(summary.difference, 2000);
});

test('closing cash nol tetap menghasilkan nilai selisih', () => {
    const summary = calculateShiftSummary({
        shift: { openingCash: 50000 },
        transactions: [],
        expenses: [],
        closingCash: 0,
    });

    assert.equal(summary.difference, -50000);
});
