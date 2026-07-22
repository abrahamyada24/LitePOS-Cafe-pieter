"use client";

import Link from 'next/link';
import { Clock3, Loader2, PlayCircle, ShieldCheck, Wallet } from 'lucide-react';

export default function ShiftGuardModal({
    visible,
    checking,
    opening,
    openingCash,
    setOpeningCash,
    onOpenShift,
    currentUser,
}) {
    if (!visible) return null;

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!checking && !opening) onOpenShift();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pb-7 pt-8 text-center text-white">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                        {checking ? <Loader2 className="animate-spin" size={30} /> : <Clock3 size={30} />}
                    </div>
                    <h2 className="text-xl font-black">{checking ? 'Memeriksa Shift' : 'Buka Shift Kasir'}</h2>
                    <p className="mt-2 text-sm text-blue-100">
                        {checking
                            ? 'Menyiapkan sesi operasional kasir...'
                            : 'Fitur shift aktif. Buka shift terlebih dahulu sebelum menerima transaksi.'}
                    </p>
                </div>

                {!checking && (
                    <form onSubmit={handleSubmit} className="space-y-5 p-6">
                        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                            <ShieldCheck className="text-blue-600" size={21} />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">Kasir Bertugas</p>
                                <p className="truncate text-sm font-bold text-blue-950">{currentUser?.name || 'Kasir'}</p>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="pos-opening-cash" className="mb-2 block text-sm font-bold text-gray-700">
                                Kas awal
                            </label>
                            <div className="relative">
                                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
                                <span className="absolute left-12 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">Rp</span>
                                <input
                                    id="pos-opening-cash"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={openingCash}
                                    onChange={(event) => setOpeningCash(event.target.value)}
                                    placeholder="0"
                                    autoFocus
                                    className="w-full rounded-xl border border-gray-200 py-3.5 pl-[4.5rem] pr-4 text-right text-lg font-black text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>
                            <p className="mt-2 text-xs text-gray-400">Masukkan uang tunai yang tersedia di laci kasir.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={opening}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {opening ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
                            {opening ? 'Membuka Shift...' : 'Buka Shift dan Mulai Kasir'}
                        </button>

                        <Link href="/" className="block text-center text-sm font-medium text-gray-500 hover:text-gray-800">
                            Kembali ke Dashboard
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
}
