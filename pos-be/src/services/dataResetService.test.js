const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESET_TYPES,
  TRANSACTION_DELETE_STEPS,
  STOCK_DELETE_STEPS,
  OPERATIONAL_DELETE_STEPS,
  getDataResetState,
  resetOperationalData,
} = require('./dataResetService');

const createTransactionMock = ({ pendingPayments = 0, rangeTransactions = [] } = {}) => {
  const deletedModels = [];
  const updates = [];
  const resetEvents = [];
  const currentSetting = {
    id: 1,
    dataResetVersion: 3,
    dataResetInProgress: false,
    dataResetAt: null,
    dataResetBy: null,
    dataResetType: null,
    dataAllResetVersion: 0,
    dataStockResetVersion: 2,
    dataTransactionResetVersion: 3,
  };
  const tx = {
    payment: {
      count: async () => pendingPayments,
      deleteMany: async () => {
        deletedModels.push('payment');
        return { count: 2 };
      },
    },
    product: {
      updateMany: async ({ data }) => {
        updates.push(['product', data]);
        return { count: 4 };
      },
    },
    dineTable: {
      deleteMany: async () => {
        deletedModels.push('dineTable');
        return { count: 1 };
      },
      updateMany: async ({ data }) => {
        updates.push(['dineTable', data]);
        return { count: 2 };
      },
    },
    storeSetting: {
      findFirst: async () => currentSetting,
      updateMany: async ({ data }) => {
        assert.deepEqual(data.dataResetVersion, { increment: 1 });
        assert.equal(data.dataResetInProgress, true);
        return { count: 1 };
      },
      update: async ({ data }) => {
        assert.equal(data.dataResetInProgress, false);
        return {};
      },
    },
    dataResetEvent: {
      create: async ({ data }) => {
        resetEvents.push(data);
        return data;
      },
    },
  };

  for (const [, modelName] of OPERATIONAL_DELETE_STEPS) {
    if (modelName === 'payment' || modelName === 'dineTable') continue;
    tx[modelName] = {
      ...tx[modelName],
      deleteMany: async () => {
        deletedModels.push(modelName);
        return { count: 1 };
      },
    };
  }
  tx.transaction.findMany = async () => rangeTransactions;

  return {
    prisma: {
      $transaction: async (callback) => callback(tx),
      storeSetting: tx.storeSetting,
      dataResetEvent: {
        findMany: async () => [],
      },
    },
    deletedModels,
    updates,
    resetEvents,
  };
};

test('reset semua menghapus semua model dan menaikkan semua versi cakupan', async () => {
  const { prisma, deletedModels } = createTransactionMock();
  const result = await resetOperationalData({ prisma, resetBy: 'owner@example.com' });

  assert.equal(result.resetState.version, 4);
  assert.equal(result.resetState.resetBy, 'owner@example.com');
  assert.equal(result.resetState.scope, RESET_TYPES.ALL);
  assert.equal(result.resetState.allResetVersion, 4);
  assert.equal(result.resetState.stockResetVersion, 4);
  assert.equal(result.resetState.transactionResetVersion, 4);
  assert.deepEqual(
    deletedModels,
    OPERATIONAL_DELETE_STEPS.map(([, modelName]) => modelName)
  );
});

test('reset stok hanya menghapus histori stok dan menolkan jumlah produk', async () => {
  const { prisma, deletedModels, updates } = createTransactionMock();
  const result = await resetOperationalData({
    prisma,
    resetBy: 'owner@example.com',
    resetType: RESET_TYPES.STOCK,
  });

  assert.equal(result.resetState.scope, RESET_TYPES.STOCK);
  assert.equal(result.resetState.allResetVersion, 0);
  assert.equal(result.resetState.stockResetVersion, 4);
  assert.equal(result.resetState.transactionResetVersion, 3);
  assert.deepEqual(deletedModels, STOCK_DELETE_STEPS.map(([, modelName]) => modelName));
  assert.deepEqual(updates, [['product', { stock: 0 }]]);
});

test('reset transaksi mempertahankan stok dan data master', async () => {
  const { prisma, deletedModels, updates } = createTransactionMock();
  const result = await resetOperationalData({
    prisma,
    resetBy: 'owner@example.com',
    resetType: RESET_TYPES.TRANSACTIONS,
  });

  assert.equal(result.resetState.scope, RESET_TYPES.TRANSACTIONS);
  assert.equal(result.resetState.stockResetVersion, 2);
  assert.equal(result.resetState.transactionResetVersion, 4);
  assert.deepEqual(deletedModels, TRANSACTION_DELETE_STEPS.map(([, modelName]) => modelName));
  assert.deepEqual(updates, [[
    'dineTable',
    { status: 'AVAILABLE', occupiedAt: null },
  ]]);
});

test('reset transaksi rentang tanggal hanya menghapus transaksi yang ditemukan', async () => {
  const { prisma, deletedModels, updates, resetEvents } = createTransactionMock({
    rangeTransactions: [
      { id: 11, tableNumber: 'A01' },
      { id: 12, tableNumber: null },
    ],
  });
  const startAt = new Date('2026-08-01T00:00:00.000+07:00');
  const endAt = new Date('2026-08-15T23:59:59.999+07:00');
  const result = await resetOperationalData({
    prisma,
    resetBy: 'owner@example.com',
    resetType: RESET_TYPES.TRANSACTIONS,
    transactionRange: { startAt, endAt },
  });

  assert.equal(result.resetState.scope, RESET_TYPES.TRANSACTIONS);
  assert.deepEqual(result.resetState.transactionRange, { startAt, endAt });
  assert.deepEqual(deletedModels, [
    'kitchenOrder',
    'payment',
    'transactionItem',
    'transaction',
  ]);
  assert.deepEqual(updates, [[
    'dineTable',
    { status: 'AVAILABLE', occupiedAt: null },
  ]]);
  assert.equal(resetEvents.length, 1);
  assert.equal(resetEvents[0].transactionStart, startAt);
  assert.equal(resetEvents[0].transactionEnd, endAt);
});

test('reset dibatalkan sebelum penghapusan bila pembayaran masih pending', async () => {
  const { prisma, deletedModels } = createTransactionMock({ pendingPayments: 1 });

  await assert.rejects(
    resetOperationalData({ prisma, resetBy: 'owner@example.com' }),
    (error) => error.code === 'PENDING_PAYMENT_EXISTS' && error.status === 409
  );
  assert.deepEqual(deletedModels, []);
});

test('status reset default aman saat StoreSetting belum tersedia', async () => {
  const state = await getDataResetState({
    storeSetting: { findFirst: async () => null },
    dataResetEvent: { findMany: async () => [] },
  });

  assert.deepEqual(state, {
    version: 0,
    inProgress: false,
    resetAt: null,
    resetBy: null,
    scope: null,
    allResetVersion: 0,
    stockResetVersion: 0,
    transactionResetVersion: 0,
    events: [],
  });
});

test('status reset mengembalikan histori event setelah versi perangkat', async () => {
  const startAt = new Date('2026-08-01T00:00:00.000+07:00');
  const endAt = new Date('2026-08-15T23:59:59.999+07:00');
  const state = await getDataResetState({
    storeSetting: {
      findFirst: async () => ({
        dataResetVersion: 4,
        dataResetType: RESET_TYPES.TRANSACTIONS,
        dataTransactionResetVersion: 4,
      }),
    },
    dataResetEvent: {
      findMany: async () => [{
        version: 4,
        resetType: RESET_TYPES.TRANSACTIONS,
        transactionStart: startAt,
        transactionEnd: endAt,
        resetAt: new Date('2026-08-15T10:00:00.000Z'),
      }],
    },
  }, { sinceVersion: 3 });

  assert.equal(state.events.length, 1);
  assert.deepEqual(state.events[0].transactionRange, { startAt, endAt });
});
