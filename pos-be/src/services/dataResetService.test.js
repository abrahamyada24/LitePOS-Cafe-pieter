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

const createTransactionMock = ({ pendingPayments = 0 } = {}) => {
  const deletedModels = [];
  const updates = [];
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

  return {
    prisma: {
      $transaction: async (callback) => callback(tx),
      storeSetting: tx.storeSetting,
    },
    deletedModels,
    updates,
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
  });
});
