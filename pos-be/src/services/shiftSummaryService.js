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

const isWithinShift = (record, shift, now) => {
    if (record.shiftId === shift.id) return true;
    if (record.shiftId !== null && record.shiftId !== undefined) return false;

    const createdAt = new Date(record.createdAt).getTime();
    const openedAt = new Date(shift.openedAt).getTime();
    const closedAt = new Date(shift.closedAt || now).getTime();
    return Number.isFinite(createdAt)
        && Number.isFinite(openedAt)
        && Number.isFinite(closedAt)
        && createdAt >= openedAt
        && createdAt <= closedAt;
};

const enrichShiftsWithSummaries = async (db, shifts = [], now = new Date()) => {
    if (!Array.isArray(shifts) || shifts.length === 0) return [];

    const shiftIds = shifts.map(shift => shift.id);
    const openedTimes = shifts.map(shift => new Date(shift.openedAt).getTime()).filter(Number.isFinite);
    const closedTimes = shifts.map(shift => new Date(shift.closedAt || now).getTime()).filter(Number.isFinite);
    const rangeStart = new Date(Math.min(...openedTimes));
    const rangeEnd = new Date(Math.max(...closedTimes));

    const [transactions, expenses] = await Promise.all([
        db.transaction.findMany({
            where: {
                status: { in: [...PAID_TRANSACTION_STATUSES] },
                OR: [
                    { shiftId: { in: shiftIds } },
                    { shiftId: null, createdAt: { gte: rangeStart, lte: rangeEnd } }
                ]
            },
            include: { payments: true }
        }),
        db.expense.findMany({
            where: {
                OR: [
                    { shiftId: { in: shiftIds } },
                    { shiftId: null, createdAt: { gte: rangeStart, lte: rangeEnd } }
                ]
            }
        })
    ]);

    return shifts.map(shift => ({
        ...shift,
        ...calculateShiftSummary({
            shift,
            transactions: transactions.filter(transaction => isWithinShift(transaction, shift, now)),
            expenses: expenses.filter(expense => isWithinShift(expense, shift, now))
        })
    }));
};

module.exports = {
    PAID_TRANSACTION_STATUSES,
    calculateShiftSummary,
    enrichShiftsWithSummaries,
};
