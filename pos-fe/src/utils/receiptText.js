import {
  getItemOriginalPrice,
  getItemProductDiscountTotal,
  getProductDiscountTotal,
  hasProductDiscount,
} from './transactionDiscounts';
import { getPaymentTypeLabel } from './paymentLabels';

const toNumber = (value) => Number(value) || 0;

const normalizeLineText = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\t\f\v]+/g, ' ')
  .trim();

const formatNumber = (value) => Math.round(toNumber(value)).toLocaleString('id-ID');

const wrapText = (value, width) => {
  const paragraphs = normalizeLineText(value).split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      let remaining = word;
      while (remaining.length > width) {
        if (current) {
          lines.push(current);
          current = '';
        }
        lines.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
      }

      if (!remaining) continue;
      if (!current) {
        current = remaining;
      } else if (`${current} ${remaining}`.length <= width) {
        current += ` ${remaining}`;
      } else {
        lines.push(current);
        current = remaining;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
};

const center = (value, width) => {
  const text = normalizeLineText(value).slice(0, width);
  return `${' '.repeat(Math.max(0, Math.floor((width - text.length) / 2)))}${text}`;
};

const columns = (leftValue, rightValue, width) => {
  const right = normalizeLineText(rightValue).slice(-width);
  const maxLeftLength = Math.max(0, width - right.length - 1);
  const left = normalizeLineText(leftValue).slice(0, maxLeftLength);
  return `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPaymentStatusLabel = (transaction) => ({
  SETTLEMENT: 'Sudah dibayar',
  PAID: 'Sudah dibayar',
  PENDING: 'Menunggu bayar',
  UNPAID: 'Belum dibayar',
  FAILED: 'Pembayaran gagal',
}[transaction?.paymentStatus || transaction?.payments?.[0]?.paymentStatus] || transaction?.status || '');

export const getReceiptCharacterWidth = (paperWidthMm) => (
  // Do not use the last physical character cells. Many 58 mm mechanisms
  // expose 384 dots (exactly 32 Font-A characters), so the final glyph can
  // lose its right edge. These conservative widths stay portable across
  // common ESC/POS printer mechanisms and drivers.
  Number(paperWidthMm) === 80 ? 42 : 30
);

export const buildReceiptText = ({
  transaction,
  store,
  paperWidthMm = 58,
  showLitePosBranding = false,
}) => {
  const width = getReceiptCharacterWidth(paperWidthMm);
  const divider = '-'.repeat(width);
  const items = transaction?.items || [];
  const lines = [];
  const storeName = store?.storeName || store?.name || 'LitePOS';
  const storeAddress = store?.address || store?.storeAddress || '';
  const storePhone = store?.phone || store?.storePhone || '';
  const receiptFooter = store?.receiptFooter ?? 'Terima kasih atas kunjungan Anda';

  for (const line of wrapText(storeName, width)) lines.push(center(line, width));
  if (storeAddress) {
    for (const line of wrapText(storeAddress, width)) lines.push(center(line, width));
  }
  if (storePhone) {
    for (const line of wrapText(`Telp: ${storePhone}`, width)) lines.push(center(line, width));
  }

  lines.push(divider);
  lines.push(`No: ${transaction?.invoiceNumber || '-'}`);
  lines.push(formatDate(transaction?.createdAt));
  lines.push(`Kasir: ${transaction?.user?.name || transaction?.cashierName || 'Kasir'}`);
  lines.push(`Pelanggan: ${transaction?.customerName || transaction?.customer?.name || 'Umum'}`);

  const tableNumber = transaction?.tableNumber || transaction?.tableName;
  const orderType = transaction?.orderType === 'DINE_IN'
    ? `Dine In${tableNumber ? ` - Meja ${tableNumber}` : ''}`
    : transaction?.orderType === 'PRE_ORDER' ? 'Pre Order' : 'Take Away';
  lines.push(`Tipe: ${orderType}`);

  const takeawayOption = transaction?.takeawayOption || transaction?.takeAwayOption;
  if (takeawayOption) lines.push(`Via: ${takeawayOption}`);
  if (transaction?.preOrderDate) {
    lines.push(`Ambil: ${formatDate(transaction.preOrderDate)}`);
    const paymentStatus = getPaymentStatusLabel(transaction);
    if (paymentStatus) lines.push(`Status bayar: ${paymentStatus}`);
  }

  lines.push(divider);
  for (const item of items) {
    const quantity = Math.max(1, toNumber(item.qty ?? item.quantity ?? 1));
    const price = Math.max(0, toNumber(item.price));
    for (const nameLine of wrapText(item.product?.name || item.name || 'Produk', width)) {
      lines.push(nameLine);
    }

    if (hasProductDiscount(item)) {
      lines.push(columns(
        `${quantity} x ${formatNumber(getItemOriginalPrice(item))}`,
        `-${formatNumber(getItemProductDiscountTotal(item))}`,
        width,
      ));
    }
    lines.push(columns(`${quantity} x ${formatNumber(price)}`, formatNumber(quantity * price), width));

    if (hasProductDiscount(item)) {
      for (const line of wrapText(`  ${item.discountLabel || 'Diskon produk'}`, width)) lines.push(line);
    }
    if (item.notes) {
      for (const line of wrapText(`  Catatan: ${item.notes}`, width)) lines.push(line);
    }
  }

  const productDiscountTotal = getProductDiscountTotal(items);
  const itemSubtotal = items.reduce((sum, item) => (
    sum + (Math.max(0, toNumber(item.price)) * Math.max(1, toNumber(item.qty ?? item.quantity ?? 1)))
  ), 0);
  const subtotal = Math.max(0, toNumber(transaction?.subTotal ?? transaction?.subtotal ?? itemSubtotal));
  const transactionDiscount = Math.max(0, toNumber(transaction?.discountAmount));
  const taxAmount = Math.max(0, toNumber(transaction?.taxAmount));
  const grandTotal = Math.max(0, toNumber(
    transaction?.grandTotal ?? transaction?.total ?? (subtotal - transactionDiscount + taxAmount),
  ));
  const taxableBase = Math.max(0, subtotal - transactionDiscount);
  const taxRate = Math.max(0, toNumber(
    transaction?.taxRate ?? (taxableBase > 0 && taxAmount > 0 ? Math.round((taxAmount / taxableBase) * 100) : 0),
  ));

  lines.push(divider);
  if (productDiscountTotal > 0) {
    lines.push(columns('Harga normal', `Rp ${formatNumber(subtotal + productDiscountTotal)}`, width));
    lines.push(columns('Diskon produk', `-Rp ${formatNumber(productDiscountTotal)}`, width));
  }
  lines.push(columns('Subtotal', `Rp ${formatNumber(subtotal)}`, width));
  if (transactionDiscount > 0) {
    lines.push(columns('Diskon transaksi', `-Rp ${formatNumber(transactionDiscount)}`, width));
  }
  if (taxAmount > 0) {
    const taxLabel = taxRate > 0 ? `Pajak (${taxRate}%)` : 'Pajak';
    lines.push(columns(taxLabel, `Rp ${formatNumber(taxAmount)}`, width));
  }
  lines.push(columns('TOTAL', `Rp ${formatNumber(grandTotal)}`, width));

  const paymentType = transaction?.payments?.[0]?.paymentType || transaction?.paymentMethod || 'CASH';
  const paymentLabel = getPaymentTypeLabel(paymentType, 'Tunai');
  const paymentStatus = transaction?.paymentStatus || transaction?.payments?.[0]?.paymentStatus;
  const paidAmount = paymentStatus === 'UNPAID'
    ? 0
    : Math.max(0, toNumber(transaction?.cashAmount ?? transaction?.payments?.[0]?.amount ?? grandTotal));
  lines.push(columns(paymentStatus === 'UNPAID' ? 'DIBAYAR' : `BAYAR (${paymentLabel})`, `Rp ${formatNumber(paidAmount)}`, width));

  const changeAmount = Math.max(0, toNumber(
    transaction?.changeAmount ?? (paidAmount > grandTotal ? paidAmount - grandTotal : 0),
  ));
  if (changeAmount > 0) lines.push(columns('KEMBALI', `Rp ${formatNumber(changeAmount)}`, width));

  lines.push(divider);
  for (const line of wrapText(receiptFooter, width)) lines.push(center(line, width));
  if (showLitePosBranding) lines.push(center('Powered by LitePOS', width));
  lines.push('', '', '');

  return lines.join('\n');
};

export const buildPrinterTestText = ({ store, paperWidthMm = 58 }) => {
  const width = getReceiptCharacterWidth(paperWidthMm);
  const divider = '-'.repeat(width);
  const lines = [];
  for (const line of wrapText(store?.storeName || 'LitePOS', width)) lines.push(center(line, width));
  lines.push(divider, center('TEST PRINT DESKTOP', width), divider);
  lines.push(columns('Lebar', `${paperWidthMm} mm`, width));
  lines.push(columns('Karakter', `${width} kolom`, width));
  lines.push(center('Teks ESC/POS siap digunakan', width), '', '', '');
  return lines.join('\n');
};
