const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateShiftSummary, enrichShiftsWithSummaries } = require('./shiftSummaryService');

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

test('tanpa kas fisik, ringkasan pembayaran tetap tersedia dan selisih tidak dihitung', () => {
    const summary = calculateShiftSummary({
        shift: { openingCash: 50000, closingCash: null },
        transactions: [
            { status: 'PAID', grandTotal: 90000, payments: [{ paymentType: 'CASH', amount: 40000 }, { paymentType: 'QRIS', amount: 50000 }] }
        ],
        expenses: [{ amount: 10000 }]
    });

    assert.equal(summary.cashSales, 40000);
    assert.equal(summary.qrisSales, 50000);
    assert.equal(summary.transferSales, 0);
    assert.equal(summary.totalSales, 90000);
    assert.equal(summary.cashExpenses, 10000);
    assert.equal(summary.difference, null);
});

test('memperkaya riwayat shift dengan rekap metode pembayaran otomatis', async () => {
    const shifts = [{
        id: 'shift-1',
        openedAt: new Date('2026-08-24T01:00:00.000Z'),
        closedAt: new Date('2026-08-24T09:00:00.000Z'),
        openingCash: 100000,
        closingCash: null,
    }];
    const db = {
        transaction: {
            findMany: async () => [
                {
                    shiftId: 'shift-1',
                    createdAt: new Date('2026-08-24T02:00:00.000Z'),
                    status: 'PAID',
                    grandTotal: 175000,
                    payments: [
                        { paymentType: 'CASH', amount: 50000 },
                        { paymentType: 'QRIS_MANUAL', amount: 75000 },
                        { paymentType: 'TRANSFER', amount: 50000 },
                    ]
                }
            ]
        },
        expense: {
            findMany: async () => [{ shiftId: 'shift-1', createdAt: new Date('2026-08-24T03:00:00.000Z'), amount: 10000 }]
        }
    };

    const [summary] = await enrichShiftsWithSummaries(db, shifts);

    assert.equal(summary.cashSales, 50000);
    assert.equal(summary.qrisSales, 75000);
    assert.equal(summary.transferSales, 50000);
    assert.equal(summary.totalSales, 175000);
    assert.equal(summary.cashExpenses, 10000);
});
