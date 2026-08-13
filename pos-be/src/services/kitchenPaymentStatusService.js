const SUCCESS_TRANSACTION_STATUSES = new Set(['PAID', 'COMPLETED']);
const SUCCESS_PAYMENT_STATUSES = new Set(['SETTLEMENT', 'PAID', 'CAPTURE']);
const FAILED_PAYMENT_STATUSES = new Set(['FAILED', 'DENY', 'EXPIRE', 'CANCEL']);

const getKitchenPaymentStatus = (transaction) => {
  if (!transaction) return 'UNPAID';

  const transactionStatus = String(transaction.status || '').toUpperCase();
  const paymentStatuses = Array.isArray(transaction.payments)
    ? transaction.payments.map(payment => String(payment.paymentStatus || '').toUpperCase())
    : [];

  if (SUCCESS_TRANSACTION_STATUSES.has(transactionStatus) || paymentStatuses.some(status => SUCCESS_PAYMENT_STATUSES.has(status))) {
    return 'PAID';
  }
  if (transactionStatus === 'CANCELLED' || paymentStatuses.some(status => FAILED_PAYMENT_STATUSES.has(status))) {
    return 'FAILED';
  }
  return 'PENDING';
};

module.exports = { getKitchenPaymentStatus };
