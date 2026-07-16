"use client";

import { useRef } from 'react';
import { Printer, X } from 'lucide-react';

export default function ReceiptPreviewModal({ isOpen, onClose, transaction, store, formatNumber }) {
    const receiptRef = useRef(null);

    if (!isOpen || !transaction) return null;

    const numberFormat = (value) => {
        const numericValue = Number(value) || 0;
        return formatNumber ? formatNumber(numericValue) : numericValue.toLocaleString('id-ID');
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const handlePrint = () => {
        if (typeof window === 'undefined') return;

        if (window.electronAPI?.printReceipt && receiptRef.current) {
            const html = `<!doctype html><html><head><meta charset="utf-8"><style>
                @page { margin: 0; }
                body { width: 58mm; margin: 0; padding: 3mm; box-sizing: border-box; font-family: monospace; color: #000; }
            </style></head><body>${receiptRef.current.innerHTML}</body></html>`;
            window.electronAPI.printReceipt(html);
            return;
        }

        window.print();
    };

    const paymentType = transaction.payments?.[0]?.paymentType || 'CASH';
    const paidAmount = transaction.cashAmount ?? transaction.payments?.[0]?.amount ?? transaction.grandTotal;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <style jsx global>{`
                @media print {
                    @page { margin: 0; }
                    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
                    body * { visibility: hidden !important; }
                    #pos-receipt-print, #pos-receipt-print * { visibility: visible !important; }
                    #pos-receipt-print {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 58mm !important;
                        padding: 3mm !important;
                        box-sizing: border-box !important;
                        box-shadow: none !important;
                        color: #000 !important;
                        background: #fff !important;
                    }
                }
            `}</style>

            <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <h2 className="font-bold text-gray-900">Preview Struk 58 mm</h2>
                        <p className="text-[11px] text-gray-400">Pilih kertas 58 mm dan margin none pada dialog printer.</p>
                    </div>
                    <button aria-label="Tutup preview struk" onClick={onClose} className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-100 p-5">
                    <div
                        id="pos-receipt-print"
                        ref={receiptRef}
                        className="mx-auto w-[58mm] bg-white p-[3mm] font-mono text-[10px] leading-tight text-black shadow-md"
                        style={{ overflowWrap: 'anywhere' }}
                    >
                        <div className="mb-3 text-center">
                            {store?.logoUrl && (
                                <img
                                    src={store.logoUrl.startsWith('http') ? store.logoUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${store.logoUrl}`}
                                    alt="Logo toko"
                                    className="mx-auto mb-2 h-10 max-w-[42mm] object-contain grayscale"
                                />
                            )}
                            <div className="text-[14px] font-black uppercase">{store?.storeName || 'LITEPOS'}</div>
                            {store?.address && <div className="mt-1 whitespace-pre-wrap">{store.address}</div>}
                            {store?.phone && <div>Telp: {store.phone}</div>}
                        </div>

                        <div className="my-2 border-t border-dashed border-black" />
                        <div className="space-y-0.5">
                            <div>No: {transaction.invoiceNumber}</div>
                            <div>{formatDate(transaction.createdAt)}</div>
                            <div>Kasir: {transaction.user?.name || 'Kasir'}</div>
                            <div>Pelanggan: {transaction.customerName || transaction.customer?.name || 'Umum'}</div>
                            <div>Tipe: {transaction.orderType === 'DINE_IN' ? 'Dine In' : transaction.orderType === 'PRE_ORDER' ? 'Pre Order' : 'Take Away'}</div>
                            {transaction.tableNumber && <div>Meja: {transaction.tableNumber}</div>}
                        </div>

                        <div className="my-2 border-t border-dashed border-black" />
                        <div className="space-y-2">
                            {transaction.items?.map((item, index) => (
                                <div key={`${item.productId || index}-${index}`}>
                                    <div className="font-bold uppercase">{item.product?.name || item.name || 'Produk'}</div>
                                    <div className="flex justify-between gap-2">
                                        <span>{item.qty || item.quantity} x {numberFormat(item.price)}</span>
                                        <span>{numberFormat(Number(item.price) * Number(item.qty || item.quantity))}</span>
                                    </div>
                                    {item.notes && <div className="italic">Catatan: {item.notes}</div>}
                                </div>
                            ))}
                        </div>

                        <div className="my-2 border-t border-dashed border-black" />
                        <div className="space-y-0.5">
                            <div className="flex justify-between"><span>Subtotal</span><span>{numberFormat(transaction.subTotal)}</span></div>
                            {Number(transaction.discountAmount) > 0 && (
                                <div className="flex justify-between"><span>Diskon</span><span>-{numberFormat(transaction.discountAmount)}</span></div>
                            )}
                            {Number(transaction.taxAmount) > 0 && (
                                <div className="flex justify-between"><span>Pajak</span><span>{numberFormat(transaction.taxAmount)}</span></div>
                            )}
                            <div className="mt-1 flex justify-between border-t border-black pt-1 text-[12px] font-black">
                                <span>TOTAL</span><span>{numberFormat(transaction.grandTotal)}</span>
                            </div>
                            <div className="flex justify-between"><span>Bayar ({paymentType})</span><span>{numberFormat(paidAmount)}</span></div>
                            {Number(transaction.changeAmount) > 0 && (
                                <div className="flex justify-between font-bold"><span>Kembali</span><span>{numberFormat(transaction.changeAmount)}</span></div>
                            )}
                        </div>

                        <div className="my-2 border-t border-dashed border-black" />
                        <div className="whitespace-pre-wrap text-center">
                            {store?.receiptFooter || 'Terima kasih atas kunjungan Anda'}
                        </div>
                        <div className="mt-2 text-center text-[8px]">Powered by LitePOS</div>
                    </div>
                </div>

                <div className="flex gap-3 border-t border-gray-100 p-4">
                    <button onClick={onClose} className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200">
                        Tutup
                    </button>
                    <button onClick={handlePrint} className="flex-[1.5] rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 flex items-center justify-center gap-2">
                        <Printer size={17} /> Cetak Struk
                    </button>
                </div>
            </div>
        </div>
    );
}
