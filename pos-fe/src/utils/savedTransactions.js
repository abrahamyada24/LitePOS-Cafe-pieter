export const isPosPendingTransaction = (transaction) => {
  try {
    const parsed = typeof transaction?.cartData === 'string'
      ? JSON.parse(transaction.cartData)
      : transaction?.cartData;

    if (Array.isArray(parsed)) return true;
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.source === 'TABLE_QR') return false;
    if (parsed.source === 'POS_PENDING') return true;

    // Data lama order meja belum selalu memiliki penanda source.
    return !parsed.tableNumber;
  } catch {
    return false;
  }
};

export const getPosPendingTransactions = (data) => (
  Array.isArray(data) ? data.filter(isPosPendingTransaction) : []
);
