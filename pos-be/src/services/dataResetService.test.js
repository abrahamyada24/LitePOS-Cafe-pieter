const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATIONAL_DELETE_STEPS,
  getDataResetState,
  resetOperationalData,
} = require('./dataResetService');

const createTransactionMock = ({ pendingPayments = 0 } = {}) => {
  const deletedModels = [];
  const tx = {
    payment: {
      count: async () => pendingPayments,
      deleteMany: async () => {
        deletedModels.push('payment');
        return { count: 2 };
      },
    },
    storeSetting: {
      findFirst: async () => ({
        id: 1,
        dataResetVersion: 3,
        dataResetInProgress: false,
        dataResetAt: null,
        dataResetBy: null,
      }),
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
    if (modelName === 'payment') continue;
    tx[modelName] = {
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
  };
};

test('reset operasional menghapus semua model dan menaikkan versi reset', async () => {
  const { prisma, deletedModels } = createTransactionMock();
  const result = await resetOperationalData({ prisma, resetBy: 'owner@example.com' });

  assert.equal(result.resetState.version, 4);
  assert.equal(result.resetState.resetBy, 'owner@example.com');
  assert.deepEqual(
    deletedModels,
    OPERATIONAL_DELETE_STEPS.map(([, modelName]) => modelName)
  );
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
  });
});
