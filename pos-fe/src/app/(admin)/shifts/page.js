"use client";
import React, { useEffect, useState } from 'react';
import { Clock, Play, Square, Loader2, DollarSign, ShoppingCart } from 'lucide-react';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ShiftsPage() {
    const [shifts, setShifts] = useState([]);
    const [currentShift, setCurrentShift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openingCash, setOpeningCash] = useState('');
    const [closingCash, setClosingCash] = useState('');
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);

    const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const getUser = () => { try { return JSON.parse(localStorage.getItem('pos-store') || '{}')?.state?.user; } catch { return null; } };
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });
    const formatRp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

    const loadData = async () => {
        setLoading(true);
        try {
            const [shiftRes, currentRes] = await Promise.all([
                fetch(`${API_URL}/api/shifts`, { headers: headers() }),
                fetch(`${API_URL}/api/shifts/current`, { headers: headers() })
            ]);
            const shiftData = await shiftRes.json();
            const currentData = await currentRes.json();
            if (shiftData.success) setShifts(shiftData.data);
            if (currentData.success) setCurrentShift(currentData.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const handleOpenShift = async (e) => {
        e.preventDefault();
        const user = getUser();
        try {
            const res = await fetch(`${API_URL}/api/shifts/open`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ userId: user?.id || 1, userName: user?.name || 'Admin', openingCash })
            });
            const data = await res.json();
            if (data.success) { setShowOpenModal(false); setOpeningCash(''); loadData(); }
            else showAlert.error('Gagal membuka shift', data.message || data.error);
        } catch (e) { showAlert.error('Gagal membuka shift', e.message || 'Coba lagi.'); }
    };

    const handleCloseShift = async (e) => {
        e.preventDefault();
        if (!currentShift) return;
        try {
            const res = await fetch(`${API_URL}/api/shifts/${currentShift.id}/close`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ closingCash })
            });
            const data = await res.json();
            if (data.success) { setShowCloseModal(false); setClosingCash(''); loadData(); showAlert.success('Shift ditutup', `Penjualan ${formatRp(data.data.totalSales)}. Selisih ${formatRp(data.data.difference)}.`); }
            else showAlert.error('Gagal menutup shift', data.message || data.error);
        } catch (e) { showAlert.error('Gagal menutup shift', e.message || 'Coba lagi.'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Manajemen Shift</h1>
                    <p className="text-sm text-gray-500 mt-1">Buka dan tutup shift kasir</p>
                </div>
                {currentShift ? (
                    <button onClick={() => setShowCloseModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg">
                        <Square size={18} /> Tutup Shift
                    </button>
                ) : (
                    <button onClick={() => setShowOpenModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-lg">
                        <Play size={18} /> Buka Shift
                    </button>
                )}
            </div>

            {currentShift && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-sm font-bold text-green-700">Shift Aktif</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div><p className="text-xs text-green-600 font-medium">Kasir</p><p className="text-sm font-bold text-green-800">{currentShift.userName}</p></div>
                        <div><p className="text-xs text-green-600 font-medium">Dibuka</p><p className="text-sm font-bold text-green-800">{new Date(currentShift.openedAt).toLocaleString('id-ID')}</p></div>
                        <div><p className="text-xs text-green-600 font-medium">Kas Awal</p><p className="text-sm font-bold text-green-800">{formatRp(Number(currentShift.openingCash))}</p></div>
                    </div>
                </div>
            )}

            {/* Open/Close Modals */}
            {(showOpenModal || showCloseModal) && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowOpenModal(false); setShowCloseModal(false); }}>
                    <form onClick={e => e.stopPropagation()} onSubmit={showOpenModal ? handleOpenShift : handleCloseShift} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                        <h2 className="text-lg font-bold text-gray-800">{showOpenModal ? 'Buka Shift Baru' : 'Tutup Shift'}</h2>
                        <input required type="number" placeholder={showOpenModal ? "Kas Awal (Rp)" : "Kas Akhir (Rp)"} value={showOpenModal ? openingCash : closingCash} onChange={e => showOpenModal ? setOpeningCash(e.target.value) : setClosingCash(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => { setShowOpenModal(false); setShowCloseModal(false); }} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                            <button type="submit" className={`flex-1 py-3 rounded-xl text-white text-sm font-bold ${showOpenModal ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>{showOpenModal ? 'Buka Shift' : 'Tutup Shift'}</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-800">Riwayat Shift</h3></div>
                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
                ) : shifts.length === 0 ? (
                    <div className="text-center py-20 text-gray-400"><Clock size={48} className="mx-auto mb-3 opacity-50" /><p className="font-medium">Belum ada riwayat shift</p></div>
                ) : (
                    <table className="w-full">
                        <thead><tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Kasir</th>
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Dibuka</th>
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Ditutup</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Kas Awal</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Kas Akhir</th>
                            <th className="text-center px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Status</th>
                        </tr></thead>
                        <tbody>
                            {shifts.map(s => (
                                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{s.userName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(s.openedAt).toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{s.closedAt ? new Date(s.closedAt).toLocaleString('id-ID') : '-'}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{formatRp(Number(s.openingCash))}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{s.closingCash ? formatRp(Number(s.closingCash)) : '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
