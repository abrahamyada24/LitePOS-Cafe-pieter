"use client";

import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export default function ReceiptPreviewModal({ isOpen, onClose, transaction, store, formatNumber }) {
    const componentRef = useRef(null);

    const handleReactPrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Receipt_${transaction?.invoiceNumber || 'POS'}`
    });

    const handlePrint = () => {
        if (typeof window !== 'undefined' && window.electronAPI) {
            // Ambil semua style Tailwind yang sedang aktif
            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(el => el.outerHTML)
                .join('');
            
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    ${styles}
                </head>
                <body class="bg-white p-4" style="font-family: monospace; width: 380px; margin: 0 auto; color: black;">
                    ${componentRef.current.innerHTML}
                </body>
                </html>
            `;
            window.electronAPI.printReceipt(html);
        } else {
            handleReactPrint();
        }
    };

    if (!isOpen || !transaction) return null;

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800">Preview Struk</h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                        <X size={20} className="text-gray-600" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex justify-center">
                    {/* Thermal Receipt Style Container */}
                    <div 
                        ref={componentRef}
                        className="bg-white p-6 shadow-sm w-[380px] max-w-full print:shadow-none print:p-0"
                        style={{ fontFamily: 'monospace' }}
                    >
                        {/* Store Info */}
                        <div className="text-center mb-6">
                            {store?.logoUrl && (
                                <img 
                                    src={store.logoUrl.startsWith('http') ? store.logoUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${store.logoUrl}`} 
                                    alt="Logo" 
                                    className="h-12 mx-auto mb-2 grayscale"
                                />
                            )}
                            <h2 className="text-xl font-bold uppercase">{store?.storeName || 'LITEPOS'}</h2>
                            <p className="text-sm whitespace-pre-wrap mt-1">{store?.address || 'Jl. Contoh Alamat No. 123'}</p>
                            <p className="text-sm mt-1">{store?.phone || '0812-3456-7890'}</p>
                        </div>

                        <div className="border-t border-dashed border-gray-400 my-4"></div>

                        {/* Transaction Info */}
                        <div className="text-sm mb-4 space-y-1">
                            <div className="flex justify-between">
                                <span>No: {transaction.invoiceNumber}</span>
                                <span>{formatDate(transaction.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Kasir: {transaction.user?.name || 'Kasir'}</span>
                                <span>Pelanggan: {transaction.customerName || transaction.customer?.name || 'Umum'}</span>
                            </div>
                            <div className="flex justify-between font-bold mt-2">
                                <span>Tipe: {transaction.orderType === 'DINE_IN' ? 'Dine In' : 'Take Away'}</span>
                                {transaction.tableNumber && <span>Meja: {transaction.tableNumber}</span>}
                            </div>
                        </div>

                        <div className="border-t border-dashed border-gray-400 my-4"></div>

                        {/* Items */}
                        <div className="text-sm space-y-3 mb-4">
                            {transaction.items?.map((item, idx) => (
                                <div key={idx} className="flex flex-col">
                                    <div className="flex justify-between">
                                        <span className="font-bold">{item.product?.name || 'Produk'}</span>
                                        <span>{formatNumber(Number(item.price) * item.qty)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>{item.qty} x {formatNumber(Number(item.price))}</span>
                                    </div>
                                    {item.notes && (
                                        <div className="text-xs italic mt-0.5 text-gray-500">Note: {item.notes}</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-dashed border-gray-400 my-4"></div>

                        {/* Totals */}
                        <div className="text-sm space-y-1 mb-4">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{formatNumber(Number(transaction.subTotal))}</span>
                            </div>
                            {Number(transaction.discountAmount) > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Diskon</span>
                                    <span>-{formatNumber(Number(transaction.discountAmount))}</span>
                                </div>
                            )}
                            {Number(transaction.taxAmount) > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Pajak (PPN)</span>
                                    <span>{formatNumber(Number(transaction.taxAmount))}</span>
                                </div>
                            )}
                            <div className="border-t border-dashed border-gray-400 my-2"></div>
                            <div className="flex justify-between font-bold text-base">
                                <span>TOTAL</span>
                                <span>{formatNumber(Number(transaction.grandTotal))}</span>
                            </div>
                        </div>

                        <div className="border-t border-dashed border-gray-400 my-4"></div>

                        {/* Payment */}
                        <div className="text-sm space-y-1 mb-6">
                            <div className="flex justify-between">
                                <span>Bayar ({transaction.payments?.[0]?.paymentType || 'CASH'})</span>
                                <span>{formatNumber(Number(transaction.cashAmount || transaction.grandTotal))}</span>
                            </div>
                            {Number(transaction.changeAmount) > 0 && (
                                <div className="flex justify-between font-bold">
                                    <span>Kembalian</span>
                                    <span>{formatNumber(Number(transaction.changeAmount))}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="text-center text-sm">
                            <p className="whitespace-pre-wrap">{store?.receiptFooter || 'Terima Kasih Atas Kunjungan Anda\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.'}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Tutup
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex-1 py-3 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                    >
                        <Printer size={18} />
                        Print Struk
                    </button>
                </div>
            </div>
        </div>
    );
}
