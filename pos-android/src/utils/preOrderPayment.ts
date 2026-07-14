export type PreOrderPaymentStatus = 'PAID' | 'UNPAID' | 'PARTIAL';

export const normalizePaymentStatus = (status?: string | null): PreOrderPaymentStatus => {
    if (status === 'UNPAID' || status === 'PARTIAL' || status === 'PAID') return status;
    return 'PAID';
};

export const getPaymentStatusLabel = (status?: string | null) => {
    const normalized = normalizePaymentStatus(status);
    if (normalized === 'UNPAID') return 'BELUM BAYAR';
    if (normalized === 'PARTIAL') return 'DP';
    return 'LUNAS';
};

export const getPaidAmount = (data: any) => {
    const total = Number(data?.grandTotal ?? data?.total ?? 0) || 0;
    const status = normalizePaymentStatus(data?.paymentStatus);
    const rawPaid = Number(data?.paidAmount ?? 0) || 0;
    if (status === 'UNPAID') return 0;
    if (rawPaid > 0) return Math.min(rawPaid, total);
    return status === 'PAID' ? total : 0;
};

export const getRemainingAmount = (data: any) => {
    const total = Number(data?.grandTotal ?? data?.total ?? 0) || 0;
    const rawRemaining = Number(data?.remainingAmount ?? 0) || 0;
    if (rawRemaining > 0) return Math.min(rawRemaining, total);
    return Math.max(0, total - getPaidAmount(data));
};

export const getPaymentStatusMessage = (data: any, formatRp: (amount: number) => string) => {
    const status = normalizePaymentStatus(data?.paymentStatus);
    const paidAmount = getPaidAmount(data);
    const remainingAmount = getRemainingAmount(data);

    if (status === 'UNPAID') {
        return `Status pembayaran: BELUM BAYAR. Total dibayar saat ambil: ${formatRp(remainingAmount)}.`;
    }
    if (status === 'PARTIAL') {
        return `Status pembayaran: DP ${formatRp(paidAmount)}. Sisa dibayar saat ambil: ${formatRp(remainingAmount)}.`;
    }
    return 'Status pembayaran: LUNAS.';
};
