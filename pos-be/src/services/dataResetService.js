const { withExclusiveDataReset } = require('./dataResetCoordinator');

const OPERATIONAL_DELETE_STEPS = [
  ['kitchenOrders', 'kitchenOrder'],
  ['queueCounters', 'orderQueueCounter'],
  ['payments', 'payment'],
  ['transactionItems', 'transactionItem'],
  ['transactions', 'transaction'],
  ['expenses', 'expense'],
  ['shifts', 'shift'],
  ['savedTransactions', 'savedTransaction'],
  ['stockReceiptItems', 'stockReceiptItem'],
  ['stockMovements', 'stockMovement'],
  ['productAddons', 'productAddon'],
  ['packageItems', 'packageItem'],
  ['stockReceipts', 'stockReceipt'],
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
    },
  });

  return {
    version: setting?.dataResetVersion || 0,
    inProgress: setting?.dataResetInProgress || false,
    resetAt: setting?.dataResetAt || null,
    resetBy: setting?.dataResetBy || null,
  };
};

const resetOperationalData = async ({ prisma, resetBy }) => withExclusiveDataReset(async () => {
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
        },
        select: {
          id: true,
          dataResetVersion: true,
          dataResetAt: true,
          dataResetBy: true,
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
      },
    });
    if (claimed.count !== 1) throw resetInProgressError();

    return {
      id: currentSetting.id,
      dataResetVersion: currentSetting.dataResetVersion + 1,
      dataResetAt: now,
      dataResetBy: resetBy,
      previous: currentSetting,
    };
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const deleted = {};
      for (const [resultKey, modelName] of OPERATIONAL_DELETE_STEPS) {
        const result = await tx[modelName].deleteMany();
        deleted[resultKey] = result.count;
      }

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
  OPERATIONAL_DELETE_STEPS,
  getDataResetState,
  resetOperationalData,
};
