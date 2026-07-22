const PAID_TRANSACTION_STATUSES = new Set(['PAID', 'COMPLETED']);

const toNumber = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const sumPayments = (transaction, acceptedTypes) => {
    return (transaction.payments || []).reduce((total, payment) => {
        if (!acceptedTypes.has(String(payment.paymentType || '').toUpperCase())) return total;
        return total + toNumber(payment.amount);
    }, 0);
};

const calculateShiftSummary = ({ shift, transactions = [], expenses = [], closingCash = null }) => {
    const paidTransactions = transactions.filter(transaction =>
        PAID_TRANSACTION_STATUSES.has(String(transaction.status || '').toUpperCase())
    );
    const cashTypes = new Set(['CASH']);
    const qrisTypes = new Set(['QRIS', 'QRIS_MANUAL']);
    const transferTypes = new Set(['TRANSFER']);

    const totalSales = paidTransactions.reduce((total, transaction) => total + toNumber(transaction.grandTotal), 0);
    const cashSales = paidTransactions.reduce((total, transaction) => total + sumPayments(transaction, cashTypes), 0);
    const qrisSales = paidTransactions.reduce((total, transaction) => total + sumPayments(transaction, qrisTypes), 0);
    const transferSales = paidTransactions.reduce((total, transaction) => total + sumPayments(transaction, transferTypes), 0);
    const cashExpenses = expenses.reduce((total, expense) => total + toNumber(expense.amount), 0);
    const openingCash = toNumber(shift?.openingCash);
    const expectedCash = openingCash + cashSales - cashExpenses;
    const parsedClosingCash = closingCash === null || closingCash === undefined
        ? (shift?.closingCash === null || shift?.closingCash === undefined ? null : toNumber(shift.closingCash))
        : toNumber(closingCash);

    return {
        totalSales,
        transactionCount: paidTransactions.length,
        cashSales,
        qrisSales,
        transferSales,
        cashExpenses,
        expectedCash,
        difference: parsedClosingCash === null ? null : parsedClosingCash - expectedCash,
    };
};

module.exports = {
    PAID_TRANSACTION_STATUSES,
    calculateShiftSummary,
};
