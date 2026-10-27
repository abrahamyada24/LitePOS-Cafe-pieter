export const receiptForTransaction = (transaction: any, items: any[]) => {
    let snapshot: any = null;
    try { snapshot = transaction.receiptJson ? JSON.parse(transaction.receiptJson) : null; } catch { /* Older receipts use stored transaction items. */ }
    return {
        ...transaction,
        ...(snapshot || { total: transaction.grandTotal, items }),
        id: transaction.id,
        total: transaction.grandTotal,
        status: transaction.status,
        paymentStatus: transaction.paymentStatus,
        paidAmount: transaction.paidAmount,
        remainingAmount: transaction.remainingAmount,
        paidAt: transaction.paidAt,
        paymentMethod: transaction.paymentMethod,
        cashAmount: transaction.cashAmount,
        changeAmount: transaction.changeAmount,
        customerPoints: snapshot?.customerPoints ?? transaction.pointsBalanceAfter ?? 0,
    };
};
