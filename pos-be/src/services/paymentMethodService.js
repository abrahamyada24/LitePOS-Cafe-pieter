const SUPPORTED_PAYMENT_TYPES = new Set(['CASH', 'TRANSFER', 'QRIS_MANUAL', 'QRIS']);

const normalizePaymentType = (value) => String(value || '').trim().toUpperCase();

const resolvePaymentMethod = (value, { midtransEnabled = false } = {}) => {
    const paymentType = normalizePaymentType(value);

    if (!SUPPORTED_PAYMENT_TYPES.has(paymentType)) {
        const error = new Error('Metode pembayaran tidak didukung.');
        error.code = 'UNSUPPORTED_PAYMENT_METHOD';
        throw error;
    }

    const isGatewayPayment = paymentType === 'QRIS';
    if (isGatewayPayment && !midtransEnabled) {
        const error = new Error('Midtrans belum diaktifkan. Gunakan QRIS Manual atau Transfer Bank.');
        error.code = 'MIDTRANS_DISABLED';
        throw error;
    }

    return {
        paymentType,
        isGatewayPayment,
        isInstantPayment: !isGatewayPayment
    };
};

module.exports = {
    normalizePaymentType,
    resolvePaymentMethod
};
