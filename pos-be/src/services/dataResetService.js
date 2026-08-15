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

const getDataResetState = async (prisma, { sinceVersion = null } = {}) => {
  const [setting, events] = await Promise.all([
    prisma.storeSetting.findFirst({
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
    }),
    Number.isInteger(sinceVersion) && sinceVersion >= 0
      ? prisma.dataResetEvent.findMany({
          where: { version: { gt: sinceVersion } },
          orderBy: { version: 'asc' },
          select: {
            version: true,
            resetType: true,
            transactionStart: true,
            transactionEnd: true,
            resetAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    version: setting?.dataResetVersion || 0,
    inProgress: setting?.dataResetInProgress || false,
    resetAt: setting?.dataResetAt || null,
    resetBy: setting?.dataResetBy || null,
    scope: setting?.dataResetType || null,
    allResetVersion: setting?.dataAllResetVersion || 0,
    stockResetVersion: setting?.dataStockResetVersion || 0,
    transactionResetVersion: setting?.dataTransactionResetVersion || 0,
    events: events.map((event) => ({
      version: event.version,
      scope: event.resetType,
      resetAt: event.resetAt,
      transactionRange: event.transactionStart && event.transactionEnd
        ? { startAt: event.transactionStart, endAt: event.transactionEnd }
        : null,
    })),
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

const resetTransactionsInRange = async (tx, transactionRange) => {
  const dateFilter = {
    gte: transactionRange.startAt,
    lte: transactionRange.endAt,
  };
  const transactions = await tx.transaction.findMany({
    where: { createdAt: dateFilter },
    select: { id: true, tableNumber: true },
  });
  const transactionIds = transactions.map((transaction) => transaction.id);
  const tableNumbers = Array.from(new Set(
    transactions.map((transaction) => transaction.tableNumber).filter(Boolean)
  ));
  const deleted = {
    kitchenOrders: 0,
    payments: 0,
    transactionItems: 0,
    transactions: 0,
    dineTablesReleased: 0,
  };

  if (transactionIds.length === 0) return deleted;

  deleted.kitchenOrders = (await tx.kitchenOrder.deleteMany({
    where: { transactionId: { in: transactionIds } },
  })).count;
  deleted.payments = (await tx.payment.deleteMany({
    where: { transactionId: { in: transactionIds } },
  })).count;
  deleted.transactionItems = (await tx.transactionItem.deleteMany({
    where: { transactionId: { in: transactionIds } },
  })).count;
  deleted.transactions = (await tx.transaction.deleteMany({
    where: { id: { in: transactionIds } },
  })).count;

  if (tableNumbers.length > 0) {
    deleted.dineTablesReleased = (await tx.dineTable.updateMany({
      where: { number: { in: tableNumbers } },
      data: { status: 'AVAILABLE', occupiedAt: null },
    })).count;
  }

  return deleted;
};

const resetSelectedData = async (tx, resetType, transactionRange = null) => {
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

  if (transactionRange) {
    return resetTransactionsInRange(tx, transactionRange);
  }

  await deleteModels(tx, TRANSACTION_DELETE_STEPS, deleted);
  const dineTables = await tx.dineTable.updateMany({
    data: { status: 'AVAILABLE', occupiedAt: null },
  });
  deleted.dineTablesReleased = dineTables.count;
  return deleted;
};

const resetOperationalData = async ({
  prisma,
  resetBy,
  resetType = RESET_TYPES.ALL,
  transactionRange = null,
}) => withExclusiveDataReset(async () => {
  if (!Object.values(RESET_TYPES).includes(resetType)) {
    const error = new Error('Jenis reset data tidak valid.');
    error.code = 'RESET_TYPE_INVALID';
    error.status = 400;
    throw error;
  }
  if (transactionRange && resetType !== RESET_TYPES.TRANSACTIONS) {
    const error = new Error('Rentang tanggal hanya dapat digunakan untuk reset transaksi.');
    error.code = 'RESET_RANGE_INVALID';
    error.status = 400;
    throw error;
  }
  if (transactionRange && (
    !(transactionRange.startAt instanceof Date)
    || !(transactionRange.endAt instanceof Date)
    || Number.isNaN(transactionRange.startAt.getTime())
    || Number.isNaN(transactionRange.endAt.getTime())
    || transactionRange.startAt > transactionRange.endAt
  )) {
    const error = new Error('Rentang tanggal transaksi tidak valid.');
    error.code = 'RESET_RANGE_INVALID';
    error.status = 400;
    throw error;
  }

  const now = new Date();
  const marker = await prisma.$transaction(async (tx) => {
    const pendingPaymentWhere = transactionRange
      ? {
          paymentStatus: 'PENDING',
          transaction: {
            createdAt: {
              gte: transactionRange.startAt,
              lte: transactionRange.endAt,
            },
          },
        }
      : { paymentStatus: 'PENDING' };
    const pendingPayments = await tx.payment.count({
      where: pendingPaymentWhere,
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
      const deleted = await resetSelectedData(tx, resetType, transactionRange);

      await tx.dataResetEvent.create({
        data: {
          version: marker.dataResetVersion,
          resetType,
          transactionStart: transactionRange?.startAt || null,
          transactionEnd: transactionRange?.endAt || null,
          resetAt: marker.dataResetAt,
          resetBy: marker.dataResetBy,
        },
      });

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
          transactionRange: transactionRange
            ? { startAt: transactionRange.startAt, endAt: transactionRange.endAt }
            : null,
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
