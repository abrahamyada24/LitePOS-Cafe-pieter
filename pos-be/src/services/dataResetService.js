const { withExclusiveDataReset } = require('./dataResetCoordinator');

const RESET_TYPES = Object.freeze({
  STOCK: 'STOCK',
  TRANSACTIONS: 'TRANSACTIONS',
  ALL: 'ALL',
});

const TRANSACTION_DELETE_STEPS = [
  ['kitchenOrders', 'kitchenOrder'],
  ['queueCounters', 'orderQueueCounter'],
  ['payments', 'payment'],
  ['transactionItems', 'transactionItem'],
  ['transactions', 'transaction'],
  ['savedTransactions', 'savedTransaction'],
];

const STOCK_DELETE_STEPS = [
  ['stockReceiptItems', 'stockReceiptItem'],
  ['stockMovements', 'stockMovement'],
  ['stockReceipts', 'stockReceipt'],
];

const OPERATIONAL_DELETE_STEPS = [
  ...TRANSACTION_DELETE_STEPS.slice(0, 5),
  ['expenses', 'expense'],
  ['shifts', 'shift'],
  TRANSACTION_DELETE_STEPS[5],
  ...STOCK_DELETE_STEPS.slice(0, 2),
  ['productAddons', 'productAddon'],
  ['packageItems', 'packageItem'],
  STOCK_DELETE_STEPS[2],
  ['packages', 'package'],
  ['suppliers', 'supplier'],
  ['dineTables', 'dineTable'],
  ['customers', 'customer'],
  ['products', 'product'],
  ['categories', 'category'],
];

const pendingPaymentError = () => {
  const error = new Error(
    'Masih ada pembayaran digital yang sedang diproses. Selesaikan atau batalkan pembayaran tersebut sebelum reset.'
  );
  error.code = 'PENDING_PAYMENT_EXISTS';
  error.status = 409;
  return error;
};

const resetInProgressError = () => {
  const error = new Error('Reset data outlet sedang berlangsung. Tunggu beberapa saat.');
  error.code = 'DATA_RESET_IN_PROGRESS';
  error.status = 423;
  return error;
};

const getDataResetState = async (prisma) => {
  const setting = await prisma.storeSetting.findFirst({
    select: {
      dataResetVersion: true,
      dataResetInProgress: true,
      dataResetAt: true,
      dataResetBy: true,
      dataResetType: true,
      dataAllResetVersion: true,
      dataStockResetVersion: true,
      dataTransactionResetVersion: true,
    },
  });

  return {
    version: setting?.dataResetVersion || 0,
    inProgress: setting?.dataResetInProgress || false,
    resetAt: setting?.dataResetAt || null,
    resetBy: setting?.dataResetBy || null,
    scope: setting?.dataResetType || null,
    allResetVersion: setting?.dataAllResetVersion || 0,
    stockResetVersion: setting?.dataStockResetVersion || 0,
    transactionResetVersion: setting?.dataTransactionResetVersion || 0,
  };
};

const buildScopeVersionData = (resetType, version) => ({
  dataResetType: resetType,
  ...(resetType === RESET_TYPES.ALL
    ? {
        dataAllResetVersion: version,
        dataStockResetVersion: version,
        dataTransactionResetVersion: version,
      }
    : {}),
  ...(resetType === RESET_TYPES.STOCK ? { dataStockResetVersion: version } : {}),
  ...(resetType === RESET_TYPES.TRANSACTIONS ? { dataTransactionResetVersion: version } : {}),
});

const deleteModels = async (tx, steps, deleted) => {
  for (const [resultKey, modelName] of steps) {
    const result = await tx[modelName].deleteMany();
    deleted[resultKey] = result.count;
  }
};

const resetSelectedData = async (tx, resetType) => {
  const deleted = {};

  if (resetType === RESET_TYPES.ALL) {
    await deleteModels(tx, OPERATIONAL_DELETE_STEPS, deleted);
    return deleted;
  }

  if (resetType === RESET_TYPES.STOCK) {
    await deleteModels(tx, STOCK_DELETE_STEPS, deleted);
    const products = await tx.product.updateMany({ data: { stock: 0 } });
    deleted.productStocksReset = products.count;
    return deleted;
  }

  await deleteModels(tx, TRANSACTION_DELETE_STEPS, deleted);
  const dineTables = await tx.dineTable.updateMany({
    data: { status: 'AVAILABLE', occupiedAt: null },
  });
  deleted.dineTablesReleased = dineTables.count;
  return deleted;
};

const resetOperationalData = async ({ prisma, resetBy, resetType = RESET_TYPES.ALL }) => withExclusiveDataReset(async () => {
  if (!Object.values(RESET_TYPES).includes(resetType)) {
    const error = new Error('Jenis reset data tidak valid.');
    error.code = 'RESET_TYPE_INVALID';
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const marker = await prisma.$transaction(async (tx) => {
    const pendingPayments = await tx.payment.count({
      where: { paymentStatus: 'PENDING' },
    });
    if (pendingPayments > 0) throw pendingPaymentError();

    const currentSetting = await tx.storeSetting.findFirst({
      select: {
        id: true,
        dataResetVersion: true,
        dataResetInProgress: true,
        dataResetAt: true,
        dataResetBy: true,
        dataResetType: true,
        dataAllResetVersion: true,
        dataStockResetVersion: true,
        dataTransactionResetVersion: true,
      },
    });
    if (currentSetting?.dataResetInProgress) throw resetInProgressError();

    if (!currentSetting) {
      const created = await tx.storeSetting.create({
        data: {
          dataResetVersion: 1,
          dataResetInProgress: true,
          dataResetAt: now,
          dataResetBy: resetBy,
          ...buildScopeVersionData(resetType, 1),
        },
        select: {
          id: true,
          dataResetVersion: true,
          dataResetAt: true,
          dataResetBy: true,
          dataResetType: true,
          dataAllResetVersion: true,
          dataStockResetVersion: true,
          dataTransactionResetVersion: true,
        },
      });
      return { ...created, previous: null };
    }

    const claimed = await tx.storeSetting.updateMany({
      where: {
        id: currentSetting.id,
        dataResetInProgress: false,
        dataResetVersion: currentSetting.dataResetVersion,
      },
      data: {
        dataResetVersion: { increment: 1 },
        dataResetInProgress: true,
        dataResetAt: now,
        dataResetBy: resetBy,
        ...buildScopeVersionData(resetType, currentSetting.dataResetVersion + 1),
      },
    });
    if (claimed.count !== 1) throw resetInProgressError();

    return {
      id: currentSetting.id,
      dataResetVersion: currentSetting.dataResetVersion + 1,
      dataResetAt: now,
      dataResetBy: resetBy,
      dataResetType: resetType,
      dataAllResetVersion: resetType === RESET_TYPES.ALL
        ? currentSetting.dataResetVersion + 1
        : currentSetting.dataAllResetVersion,
      dataStockResetVersion: [RESET_TYPES.ALL, RESET_TYPES.STOCK].includes(resetType)
        ? currentSetting.dataResetVersion + 1
        : currentSetting.dataStockResetVersion,
      dataTransactionResetVersion: [RESET_TYPES.ALL, RESET_TYPES.TRANSACTIONS].includes(resetType)
        ? currentSetting.dataResetVersion + 1
        : currentSetting.dataTransactionResetVersion,
      previous: currentSetting,
    };
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const deleted = await resetSelectedData(tx, resetType);

      await tx.storeSetting.update({
        where: { id: marker.id },
        data: { dataResetInProgress: false },
      });

      return {
        deleted,
        resetState: {
          version: marker.dataResetVersion,
          inProgress: false,
          resetAt: marker.dataResetAt,
          resetBy: marker.dataResetBy,
          scope: marker.dataResetType,
          allResetVersion: marker.dataAllResetVersion,
          stockResetVersion: marker.dataStockResetVersion,
          transactionResetVersion: marker.dataTransactionResetVersion,
        },
      };
    });
  } catch (error) {
    if (marker.previous) {
      await prisma.storeSetting.updateMany({
        where: {
          id: marker.id,
          dataResetVersion: marker.dataResetVersion,
          dataResetInProgress: true,
        },
        data: {
          dataResetVersion: marker.previous.dataResetVersion,
          dataResetInProgress: false,
          dataResetAt: marker.previous.dataResetAt,
          dataResetBy: marker.previous.dataResetBy,
          dataResetType: marker.previous.dataResetType,
          dataAllResetVersion: marker.previous.dataAllResetVersion,
          dataStockResetVersion: marker.previous.dataStockResetVersion,
          dataTransactionResetVersion: marker.previous.dataTransactionResetVersion,
        },
      }).catch(() => {});
    } else {
      await prisma.storeSetting.deleteMany({
        where: {
          id: marker.id,
          dataResetVersion: marker.dataResetVersion,
          dataResetInProgress: true,
        },
      }).catch(() => {});
    }
    throw error;
  }
});

module.exports = {
  RESET_TYPES,
  TRANSACTION_DELETE_STEPS,
  STOCK_DELETE_STEPS,
  OPERATIONAL_DELETE_STEPS,
  getDataResetState,
  resetOperationalData,
};
