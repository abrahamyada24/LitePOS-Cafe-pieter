const PAYMENT_TYPE_LABELS = Object.freeze({
  CASH: 'Tunai',
  TUNAI: 'Tunai',
  TRANSFER: 'Transfer Bank',
  BANK_TRANSFER: 'Transfer Bank',
  QRIS: 'QRIS',
  QRIS_MANUAL: 'QRIS',
  DEBIT: 'Kartu Debit',
});

export const getPaymentTypeLabel = (paymentType, fallback = '-') => {
  const value = String(paymentType || '').trim();
  if (!value) return fallback;

  const normalized = value.toUpperCase();
  if (PAYMENT_TYPE_LABELS[normalized]) return PAYMENT_TYPE_LABELS[normalized];

  const withoutInternalTerms = value
    .split(/[_\s-]+/)
    .filter((part) => part.toUpperCase() !== 'MANUAL')
    .join(' ')
    .trim();

  return withoutInternalTerms || fallback;
};
