"use client";

import { X, Banknote, QrCode, CheckCircle2, Loader2, ExternalLink, RotateCcw, CreditCard, Printer } from 'lucide-react';

export default function PaymentModal({
    isOpen, onClose, paymentStep, setPaymentStep, paymentMethod, setPaymentMethod,
    cashGiven, setCashGiven, handleCashInput, isCashSufficient, change, deficit,
    handleProcessTransaction, resetTransaction, isProcessing, hasReceipt, onOpenReceipt,
    grandTotal, formatNumber
}) {

    const DENOMINATIONS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

    const handleDenominationClick = (amount) => {
        const current = Number(cashGiven) || 0;
        const newValue = current + amount;
        setCashGiven && setCashGiven(newValue);
    };

    const handleExactAmount = () => {
        setCashGiven && setCashGiven(grandTotal);
    };

    const handleResetCash = () => {
        setCashGiven && setCashGiven(0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                {/* HEADER - Clean Style */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-800">Pembayaran</h3>
                    {/* Tombol Close hanya muncul jika tidak sedang memproses */}
                    {!isProcessing && paymentStep !== 'SUCCESS' && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="p-6 overflow-y-auto">

                    {/* STEP 1: PILIH METODE */}
                    {paymentStep === 'SELECT' && (
                        <div className="space-y-6">
                            <div className="text-center py-4">
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Tagihan</p>
                                <h2 className="text-4xl font-black text-gray-900">Rp {formatNumber(grandTotal)}</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => { setPaymentMethod('CASH'); setPaymentStep('INPUT_CASH'); }}
                                    className="w-full p-4 border border-gray-200 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                >
                                    <div className="p-3 bg-gray-100 text-gray-500 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Banknote size={24} />
                                    </div>
                                    <div className="text-left">
                                        <span className="block font-bold text-gray-800">Tunai (Cash)</span>
                                        <span className="text-[10px] text-gray-400">Bayar manual dengan uang fisik</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleProcessTransaction('TRANSFER')}
                                    className="w-full p-4 border border-gray-200 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                >
                                    <div className="p-3 bg-gray-100 text-gray-500 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <CreditCard size={24} />
                                    </div>
                                    <div className="text-left">
                                        <span className="block font-bold text-gray-800">Transfer Bank</span>
                                        <span className="text-[10px] text-gray-400">Bayar via transfer bank / e-wallet</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleProcessTransaction('QRIS')}
                                    className="w-full p-4 border border-gray-200 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                >
                                    <div className="p-3 bg-gray-100 text-gray-500 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <QrCode size={24} />
                                    </div>
                                    <div className="text-left">
                                        <span className="block font-bold text-gray-800">QRIS (Midtrans)</span>
                                        <span className="text-[10px] text-gray-400">Scan otomatis via Midtrans</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleProcessTransaction('QRIS_MANUAL')}
                                    className="w-full p-4 border border-gray-200 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                >
                                    <div className="p-3 bg-gray-100 text-gray-500 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <QrCode size={24} />
                                    </div>
                                    <div className="text-left">
                                        <span className="block font-bold text-gray-800">QRIS (Manual)</span>
                                        <span className="text-[10px] text-gray-400">Pencatatan QRIS statis toko</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: PROCESSING (Waiting for Snap) */}
                    {paymentStep === 'PROCESSING' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="animate-spin text-blue-500" size={40} />
                            <div className="text-center">
                                <p className="font-bold text-gray-800">Menyiapkan Pembayaran...</p>
                                <p className="text-xs text-gray-400 mt-1">Jangan tutup jendela ini hingga QR muncul.</p>
                            </div>

                            {/* LINK SIMULATOR UNTUK DIBUKA MANUAL JIKA SNAP TERBLOKIR */}
                            <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 w-full">
                                <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Petunjuk Sandbox:</p>
                                <p className="text-[10px] text-blue-500 leading-relaxed mb-3">
                                    Jika popup QR tidak muncul, pastikan browser Anda mengizinkan "Pop-up". Gunakan link di bawah untuk simulasi:
                                </p>
                                <a
                                    href="https://simulator.sandbox.midtrans.com/qris/index"
                                    target="_blank"
                                    className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Buka Simulator Midtrans <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: INPUT CASH */}
                    {paymentStep === 'INPUT_CASH' && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600">Uang Diterima</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={cashGiven === 0 ? '' : formatNumber(cashGiven)}
                                        onChange={handleCashInput}
                                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-100 rounded-2xl text-2xl font-black text-gray-800 focus:outline-none focus:border-blue-500 transition-all"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Quick Actions: UANG PAS & Reset */}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExactAmount}
                                    className="flex-1 py-2.5 text-xs font-bold bg-green-50 text-green-600 border border-green-200 rounded-xl hover:bg-green-100 transition-all active:scale-95"
                                >
                                    UANG PAS
                                </button>
                                <button
                                    onClick={handleResetCash}
                                    className="py-2.5 px-4 text-xs font-bold bg-gray-50 text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all flex items-center gap-1.5 active:scale-95"
                                >
                                    <RotateCcw size={12} /> Reset
                                </button>
                            </div>

                            {/* Cash Denomination Buttons */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pecahan Uang</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {DENOMINATIONS.map((denom) => (
                                        <button
                                            key={denom}
                                            onClick={() => handleDenominationClick(denom)}
                                            className="py-2.5 text-[11px] font-bold bg-white border border-gray-200 rounded-xl text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95 shadow-sm"
                                        >
                                            {denom >= 1000 ? `${(denom / 1000).toLocaleString('id-ID')}rb` : formatNumber(denom)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={`p-4 rounded-2xl border flex justify-between items-center ${isCashSufficient ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                <span className="text-sm font-bold text-gray-600">{isCashSufficient ? 'Kembalian' : 'Kurang'}</span>
                                <span className={`text-xl font-black ${isCashSufficient ? 'text-green-600' : 'text-red-600'}`}>
                                    Rp {isCashSufficient ? formatNumber(change) : formatNumber(deficit)}
                                </span>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPaymentStep('SELECT')}
                                    className="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600"
                                >
                                    Kembali
                                </button>
                                <button
                                    disabled={!isCashSufficient || isProcessing}
                                    onClick={() => handleProcessTransaction('CASH')}
                                    className="flex-[2] py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-blue-600 disabled:bg-gray-200 transition-all shadow-lg active:scale-95"
                                >
                                    Konfirmasi Bayar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: SUKSES */}
                    {paymentStep === 'SUCCESS' && (
                        <div className="text-center py-8 space-y-6">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                                <CheckCircle2 size={48} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-800">Pembayaran Berhasil</h3>
                                <p className="text-sm text-gray-400 mt-1">Transaksi telah tercatat dan struk siap dicetak.</p>
                            </div>
                            <div className="space-y-3">
                                <button
                                    disabled={!hasReceipt}
                                    onClick={onOpenReceipt}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 disabled:bg-gray-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} /> Lihat & Cetak Struk
                                </button>
                                <button
                                    onClick={resetTransaction}
                                    className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                                >
                                    Selesai & Transaksi Baru
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
