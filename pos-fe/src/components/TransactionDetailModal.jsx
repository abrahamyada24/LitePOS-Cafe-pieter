"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Calendar, User, CreditCard, Printer, ShoppingBag, Store, FileText, MapPin, UtensilsCrossed, RotateCcw, Loader2, Share2 } from 'lucide-react';
import { DEFAULT_DEVICE_PREFERENCES, getDevicePreferences, getPaperWidthMm } from '@/utils/devicePreferences';
import { useStore } from '@/store/useStore';
import { getItemOriginalPrice, getItemProductDiscountTotal, getProductDiscountTotal, hasProductDiscount } from '@/utils/transactionDiscounts';
import { shouldShowLitePosBranding } from '@/utils/receiptBranding';
import { createReceiptImageBlob, getReceiptImageFilename, shareReceiptImage } from '@/utils/receiptImage';
import { showAlert } from '@/utils/swal';
import { printReceiptElement } from '@/utils/receiptPrint';
import { getPaymentTypeLabel } from '@/utils/paymentLabels';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function TransactionDetailModal({ isOpen, onClose, transaction, canReturn = false, isReturning = false, onReturn }) {
    const receiptRef = useRef(null);
    const imageGenerationRef = useRef(0);
    const [storeSettings, setStoreSettings] = useState(null);
    const [devicePreferences, setDevicePreferences] = useState(DEFAULT_DEVICE_PREFERENCES);
    const [receiptImageBlob, setReceiptImageBlob] = useState(null);
    const [receiptImageError, setReceiptImageError] = useState('');
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const license = useStore((state) => state.license);

    const prepareReceiptImage = useCallback(async () => {
        const node = receiptRef.current;
        if (!node) throw new Error('Struk belum siap dibuat menjadi gambar.');

        const generation = ++imageGenerationRef.current;
        setIsPreparingImage(true);
        setReceiptImageError('');

        try {
            const blob = await createReceiptImageBlob(node);
            if (imageGenerationRef.current === generation) setReceiptImageBlob(blob);
            return blob;
        } catch (error) {
            if (imageGenerationRef.current === generation) {
                setReceiptImageBlob(null);
                setReceiptImageError(error?.message || 'Gambar struk belum dapat disiapkan.');
            }
            throw error;
        } finally {
            if (imageGenerationRef.current === generation) setIsPreparingImage(false);
        }
    }, []);

    // Fetch store settings for receipt header
    useEffect(() => {
        if (isOpen) {
            setDevicePreferences(getDevicePreferences());
            const fetchSettings = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${API_URL}/api/settings`, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                        credentials: 'include',
                        cache: 'no-store',
                    });
                    const data = await res.json();
                    if (data.success && data.data) {
                        setStoreSettings(data.data);
                    }
                } catch (e) { console.error('Failed to fetch settings for receipt', e); }
            };
            fetchSettings();
        }
    }, [isOpen]);

    useEffect(() => {
        imageGenerationRef.current += 1;
        setReceiptImageBlob(null);
        setReceiptImageError('');
        setIsPreparingImage(false);
        if (!isOpen || !transaction) return undefined;

        const timer = window.setTimeout(() => {
            prepareReceiptImage().catch(() => undefined);
        }, 150);

        return () => {
            window.clearTimeout(timer);
            imageGenerationRef.current += 1;
        };
    }, [devicePreferences, isOpen, prepareReceiptImage, storeSettings, transaction]);

    if (!isOpen || !transaction) return null;

    const { items = [], payments, user, customer } = transaction;

    const formatRp = (num) => "Rp " + (Number(num) || 0).toLocaleString('id-ID');
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Calculate tax percentage from transaction data
    const orderDiscountAmount = Number(transaction.discountAmount || 0);
    const taxableBase = Math.max(0, Number(transaction.subTotal || 0) - orderDiscountAmount);
    const taxPct = taxableBase > 0 && transaction.taxAmount > 0
        ? Math.round((transaction.taxAmount / taxableBase) * 100)
        : 0;
    const productDiscountTotal = getProductDiscountTotal(items);

    // Store info for receipt
    const storeName = storeSettings?.storeName || 'TOKO';
    const storeAddress = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';
    const receiptFooter = storeSettings?.receiptFooter ?? 'Terima kasih atas kunjungan Anda';
    const storeLogo = storeSettings?.logoUrl
        ? (storeSettings.logoUrl.startsWith('http') ? storeSettings.logoUrl : `${API_URL}${storeSettings.logoUrl}`)
        : '';
    const paperWidthMm = getPaperWidthMm(devicePreferences);
    const logoMaxWidthMm = paperWidthMm === 80 ? 58 : 42;
    const showLitePosBranding = shouldShowLitePosBranding(license);

    // Payment info
    const paymentType = payments?.[0]?.paymentType || 'TUNAI';
    const paymentTypeLabel = getPaymentTypeLabel(paymentType, 'Tunai');
    const rawPaymentStatus = transaction.paymentStatus || payments?.[0]?.paymentStatus || '';
    const paymentStatusLabel = {
        SETTLEMENT: 'Sudah dibayar',
        PAID: 'Sudah dibayar',
        PENDING: 'Menunggu bayar',
        UNPAID: 'Belum dibayar',
        FAILED: 'Pembayaran gagal',
    }[rawPaymentStatus] || transaction.status;
    const paymentAmount = payments?.[0]?.amount || transaction.grandTotal;
    const changeAmount = Number(paymentAmount) - Number(transaction.grandTotal);
    const returnableTransaction = canReturn && ['PAID', 'COMPLETED'].includes(transaction.status);

    // --- FUNGSI CETAK STRUK ---
    const handlePrint = async () => {
        try {
            await printReceiptElement(receiptRef.current, {
                paperWidthMm,
                printMarginMm: devicePreferences.printMarginMm,
            });
        } catch (error) {
            showAlert.error('Gagal Mencetak', error?.message || 'Browser tidak dapat menyiapkan struk.');
        }
    };

    const handleShareImage = async () => {
        if (isPreparingImage || isSharing) return;

        if (!receiptImageBlob) {
            try {
                await prepareReceiptImage();
                await showAlert.info('Gambar Struk Siap', 'Tekan Share Sosmed sekali lagi lalu pilih WhatsApp.');
            } catch (error) {
                showAlert.error('Gagal Membuat Gambar', error?.message || 'Struk belum dapat dibagikan.');
            }
            return;
        }

        setIsSharing(true);
        try {
            const result = await shareReceiptImage({
                blob: receiptImageBlob,
                filename: getReceiptImageFilename(transaction.invoiceNumber),
                title: `Struk ${transaction.invoiceNumber || ''}`.trim(),
                text: `Struk transaksi ${storeName}`,
            });
            if (result === 'downloaded') {
                await showAlert.info(
                    'Gambar Struk Diunduh',
                    'Browser ini belum mendukung berbagi file langsung. Pilih gambar dari folder Download saat membuka WhatsApp.'
                );
            }
        } catch (error) {
            if (error?.name !== 'AbortError') {
                showAlert.error('Gagal Membagikan Gambar', error?.message || 'Menu berbagi belum dapat dibuka.');
            }
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">

            {/* CSS PRINT ENGINE */}
            <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          
          #receipt-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: ${paperWidthMm}mm;
            padding: ${devicePreferences.printMarginMm}mm;
            background: white;
            color: black;
            font-family: 'Courier New', Courier, monospace;
            line-height: 1.2;
          }

          #receipt-print .receipt-logo {
            display: block !important;
            width: auto !important;
            height: auto !important;
            max-width: ${logoMaxWidthMm}mm !important;
            max-height: 16mm !important;
            margin: 0 auto 3mm !important;
            object-fit: contain !important;
          }
          
          .no-print { display: none !important; }
          
          @page {
            size: ${paperWidthMm}mm auto;
            margin: 0mm;
          }
        }
      `}</style>

            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header Modal */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 no-print">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <FileText size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">Detail Transaksi</h3>
                            <p className="text-[10px] text-gray-400 font-mono font-bold uppercase">{transaction.invoiceNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 no-print">

                    <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-700 text-sm font-bold">
                            <Calendar size={16} />
                            {formatDate(transaction.createdAt)}
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border ${transaction.status === 'PAID' || transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' : transaction.status === 'RETURNED' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                            }`}>
                            {transaction.status}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Kasir</p>
                            <div className="flex items-center gap-2 font-bold text-gray-700 text-xs">
                                <User size={12} /> {user?.name || 'Authorized Staff'}
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Pelanggan</p>
                            <div className="flex items-center gap-2 font-bold text-gray-700 text-xs">
                                <User size={12} /> {transaction.customerName || customer?.name || 'Umum / Guest'}
                            </div>
                        </div>
                    </div>

                    {/* Order Type & Table */}
                    <div className="flex gap-3">
                        <div className={`flex-1 p-3 rounded-xl border ${transaction.orderType === 'DINE_IN' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tipe Pesanan</p>
                            <div className={`flex items-center gap-2 font-bold text-xs ${transaction.orderType === 'DINE_IN' ? 'text-orange-700' : 'text-blue-700'}`}>
                                <UtensilsCrossed size={12} />
                                {transaction.orderType === 'DINE_IN' ? 'Dine-In' : transaction.orderType === 'PRE_ORDER' ? 'Pre-Order' : 'Take Away'}
                            </div>
                        </div>
                        {transaction.tableNumber && (
                            <div className="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Nomor Meja</p>
                                <div className="flex items-center gap-2 font-bold text-xs text-gray-700">
                                    <MapPin size={12} /> Meja {transaction.tableNumber}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Takeaway Option */}
                    {transaction.takeawayOption && (
                        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Layanan Online</p>
                            <div className="font-bold text-xs text-indigo-700">{transaction.takeawayOption}</div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Ringkasan Pesanan</p>
                        <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Menu</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-gray-700 text-xs">{item.product?.name || 'Menu'}</p>
                                                {hasProductDiscount(item) ? (
                                                    <>
                                                        <p className="text-[9px] text-gray-400">
                                                            @ <span className="line-through">{formatRp(getItemOriginalPrice(item))}</span>{' '}
                                                            <span className="font-bold text-emerald-600">{formatRp(item.price)}</span>
                                                        </p>
                                                        <p className="mt-0.5 text-[9px] font-semibold text-emerald-600">
                                                            Diskon produk -{formatRp(getItemProductDiscountTotal(item))}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-[9px] text-gray-400">@ {formatRp(item.price)}</p>
                                                )}
                                                {item.notes && <p className="mt-1 text-[9px] italic text-gray-500">{item.notes}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-xs">{item.qty}</td>
                                            <td className="px-4 py-3 text-right font-black text-xs text-gray-900">{formatRp(item.price * item.qty)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-gray-900 rounded-2xl p-6 text-white space-y-3 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Store size={80} />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <span>Metode Pembayaran</span>
                            <span className="text-blue-400 flex items-center gap-1">
                                <CreditCard size={12} /> {paymentTypeLabel}
                            </span>
                        </div>
                        {productDiscountTotal > 0 && (
                            <>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400 font-bold uppercase tracking-widest">Harga normal</span>
                                    <span className="font-bold text-white">{formatRp(Number(transaction.subTotal) + productDiscountTotal)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-emerald-400 font-bold uppercase tracking-widest">Diskon produk</span>
                                    <span className="font-bold text-emerald-400">-{formatRp(productDiscountTotal)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400 font-bold uppercase tracking-widest">Subtotal</span>
                            <span className="font-bold text-white">{formatRp(transaction.subTotal)}</span>
                        </div>
                        {taxPct > 0 && (
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400 font-bold uppercase tracking-widest">Pajak ({taxPct}%)</span>
                                <span className="font-bold text-white">{formatRp(transaction.taxAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xs pb-3 border-b border-white/10">
                            <span className="text-gray-400 font-bold uppercase tracking-widest">Diskon transaksi</span>
                            <span className="font-bold text-white">{orderDiscountAmount > 0 ? `-${formatRp(orderDiscountAmount)}` : formatRp(0)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-black uppercase tracking-tighter text-blue-500">Total Akhir</span>
                            <span className="text-2xl font-black italic">{formatRp(transaction.grandTotal)}</span>
                        </div>
                        {paymentType === 'CASH' && changeAmount > 0 && (
                            <div className="flex justify-between text-xs pt-2 border-t border-white/10">
                                <span className="text-gray-400 font-bold uppercase tracking-widest">Bayar / Kembali</span>
                                <span className="font-bold text-green-400">{formatRp(paymentAmount)} / {formatRp(changeAmount)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- RECEIPT TEMPLATE (STRUK FISIK) --- */}
                <div
                    id="receipt-print"
                    ref={receiptRef}
                    aria-hidden="true"
                    className="fixed -left-[10000px] top-0 mx-auto block bg-white font-mono text-[10px] leading-tight text-black"
                    style={{
                        overflowWrap: 'anywhere',
                        width: `${paperWidthMm}mm`,
                        padding: `${devicePreferences.printMarginMm}mm`,
                        boxSizing: 'border-box',
                    }}
                >
                    <div className="mb-3 text-center">
                        {storeLogo && (
                            <img
                                src={storeLogo}
                                alt="Logo toko"
                                className="receipt-logo grayscale"
                                style={{
                                    display: 'block',
                                    width: 'auto',
                                    height: 'auto',
                                    maxWidth: `${logoMaxWidthMm}mm`,
                                    maxHeight: '16mm',
                                    margin: '0 auto 2mm',
                                    objectFit: 'contain',
                                }}
                            />
                        )}
                        <div className="receipt-store-name text-[14px] font-black">{storeName}</div>
                        {storeAddress && <div className="mt-1 whitespace-pre-wrap">{storeAddress}</div>}
                        {storePhone && <div>Telp: {storePhone}</div>}
                    </div>

                    <div className="my-2 border-t border-dashed border-black" />
                    <div className="space-y-0.5">
                        <div>No: {transaction.invoiceNumber}</div>
                        <div>{formatDate(transaction.createdAt)}</div>
                        <div>Kasir: {user?.name || 'Kasir'}</div>
                        <div>Pelanggan: {transaction.customerName || customer?.name || 'Umum'}</div>
                        <div>Tipe: {transaction.orderType === 'DINE_IN' ? (transaction.tableNumber ? `Dine In - Meja ${transaction.tableNumber}` : 'Dine In') : transaction.orderType === 'PRE_ORDER' ? 'Pre Order' : 'Take Away'}</div>
                        {transaction.takeawayOption && <div>Via: {transaction.takeawayOption}</div>}
                        {transaction.preOrderDate && <div>Ambil: {formatDate(transaction.preOrderDate)}</div>}
                        {transaction.preOrderDate && <div>Status bayar: {paymentStatusLabel}</div>}
                    </div>

                    <div className="my-2 border-t border-dashed border-black" />
                    <div className="space-y-2">
                        {items.map((item, index) => (
                            <div key={`${item.productId || index}-${index}`}>
                                <div className="font-bold">{item.product?.name || item.name || 'Produk'}</div>
                                {hasProductDiscount(item) && (
                                    <div className="receipt-value-row flex justify-between gap-2">
                                        <span>{item.qty || item.quantity} x <span className="line-through">{Number(getItemOriginalPrice(item)).toLocaleString('id-ID')}</span></span>
                                        <span>-{Number(getItemProductDiscountTotal(item)).toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                <div className="receipt-value-row flex justify-between gap-2">
                                    <span>{item.qty || item.quantity} x {Number(item.price).toLocaleString('id-ID')}</span>
                                    <span>{Number(Number(item.price) * Number(item.qty || item.quantity)).toLocaleString('id-ID')}</span>
                                </div>
                                {hasProductDiscount(item) && <div className="italic">{item.discountLabel || 'Diskon produk'}</div>}
                                {item.notes && <div className="italic">Catatan: {item.notes}</div>}
                            </div>
                        ))}
                    </div>

                    <div className="my-2 border-t border-dashed border-black" />
                    <div className="space-y-0.5">
                        {productDiscountTotal > 0 && (
                            <>
                                <div className="receipt-value-row flex justify-between"><span>Harga normal</span><span>{Number(Number(transaction.subTotal) + productDiscountTotal).toLocaleString('id-ID')}</span></div>
                                <div className="receipt-value-row flex justify-between"><span>Diskon produk</span><span>-{Number(productDiscountTotal).toLocaleString('id-ID')}</span></div>
                            </>
                        )}
                        <div className="receipt-value-row flex justify-between"><span>Subtotal</span><span>{Number(transaction.subTotal).toLocaleString('id-ID')}</span></div>
                        {Number(transaction.discountAmount) > 0 && (
                            <div className="receipt-value-row flex justify-between"><span>Diskon transaksi</span><span>-{Number(transaction.discountAmount).toLocaleString('id-ID')}</span></div>
                        )}
                        {Number(transaction.taxAmount) > 0 && (
                            <div className="receipt-value-row flex justify-between">
                                <span>{taxPct > 0 ? `Pajak (${taxPct}%)` : 'Pajak'}</span>
                                <span>{Number(transaction.taxAmount).toLocaleString('id-ID')}</span>
                            </div>
                        )}
                        <div className="receipt-value-row mt-1 flex justify-between border-t border-black pt-1 text-[12px] font-black">
                            <span>TOTAL</span><span>{Number(transaction.grandTotal).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="receipt-value-row flex justify-between"><span>Bayar ({paymentTypeLabel})</span><span>{Number(paymentAmount).toLocaleString('id-ID')}</span></div>
                        {Number(changeAmount) > 0 && (
                            <div className="receipt-value-row flex justify-between font-bold"><span>Kembali</span><span>{Number(changeAmount).toLocaleString('id-ID')}</span></div>
                        )}
                    </div>

                    <div className="my-2 border-t border-dashed border-black" />
                    <div className="whitespace-pre-wrap text-center">
                        {receiptFooter}
                    </div>
                    {showLitePosBranding && (
                        <div className="mt-2 text-center text-[8px]">Powered by LitePOS</div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap justify-end gap-3 no-print">
                    {receiptImageError && (
                        <span className="w-full text-right text-[10px] font-semibold text-amber-600">Gambar belum siap; tekan Share Sosmed untuk mencoba lagi.</span>
                    )}
                    {returnableTransaction && (
                        <button
                            onClick={onReturn}
                            disabled={isReturning}
                            className="px-5 py-2.5 text-xs font-black text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isReturning ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} strokeWidth={3} />}
                            {isReturning ? 'Memproses' : 'Retur'}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        disabled={isReturning}
                        className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-800 transition-colors"
                    >
                        Tutup
                    </button>
                    <button
                        onClick={handleShareImage}
                        disabled={isPreparingImage || isSharing || isReturning}
                        title="Bagikan gambar struk lalu pilih WhatsApp"
                        className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100 uppercase tracking-widest disabled:cursor-wait disabled:opacity-60"
                    >
                        {isPreparingImage || isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} strokeWidth={3} />}
                        {isPreparingImage ? 'Menyiapkan' : isSharing ? 'Membuka' : receiptImageBlob ? 'Share WhatsApp' : 'Siapkan Share'}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2.5 text-xs font-black text-white bg-gray-950 hover:bg-blue-600 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-gray-200 uppercase tracking-widest"
                    >
                        <Printer size={16} strokeWidth={3} /> Cetak Struk
                    </button>
                </div>
            </div>
        </div >
    );
}
