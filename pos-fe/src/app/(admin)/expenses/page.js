"use client";
import React, { useEffect, useState } from 'react';
import { Wallet, Plus, Trash2, Loader2, Calendar, Filter, ShoppingBag, Receipt, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const EXPENSE_CATEGORIES = ['Umum', 'Operasional', 'Gaji', 'Bahan Baku', 'Utilitas', 'Lainnya'];
const EXPENSE_TYPES = [
    { value: 'EXPENSE', label: 'Pengeluaran', icon: ArrowUpCircle, color: 'red' },
    { value: 'PURCHASE', label: 'Pembelian', icon: ShoppingBag, color: 'orange' }
];

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ description: '', amount: '', category: 'Umum', type: 'EXPENSE' });
    const [filterType, setFilterType] = useState('ALL');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });
    const formatRp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    const loadExpenses = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/expenses?startDate=${startDate}&endDate=${endDate}`, { headers: headers() });
            const data = await res.json();
            if (data.success) { setExpenses(data.data); setTotal(data.total); }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadExpenses(); }, [startDate, endDate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/expenses`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (data.success) {
                setShowForm(false);
                setForm({ description: '', amount: '', category: 'Umum', type: 'EXPENSE' });
                loadExpenses();
            }
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        const confirmed = await showAlert.confirmDanger('Hapus pengeluaran?', 'Catatan pengeluaran ini tidak dapat dikembalikan.', 'Ya, Hapus');
        if (!confirmed) return;
        try {
            const response = await fetch(`${API_URL}/api/expenses/${id}`, { method: 'DELETE', headers: headers() });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || data.error);
            loadExpenses();
            showAlert.success('Pengeluaran dihapus', 'Catatan berhasil dihapus.');
        } catch (e) { showAlert.error('Gagal menghapus', e.message || 'Coba lagi.'); }
    };

    // Filter by type
    const filteredExpenses = filterType === 'ALL' ? expenses : expenses.filter(e => e.type === filterType);
    const filteredTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Type stats
    const expenseTotal = expenses.filter(e => !e.type || e.type === 'EXPENSE').reduce((s, e) => s + Number(e.amount), 0);
    const purchaseTotal = expenses.filter(e => e.type === 'PURCHASE').reduce((s, e) => s + Number(e.amount), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Pengeluaran</h1>
                    <p className="text-sm text-gray-500 mt-1">Catat pengeluaran operasional & pembelian harian</p>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-lg">
                    <Plus size={18} /> Tambah
                </button>
            </div>

            {/* Type Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                    onClick={() => setFilterType('ALL')}
                    className={`p-4 rounded-2xl border transition-all text-left ${filterType === 'ALL' ? 'bg-gray-900 text-white border-gray-900 shadow-lg' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                >
                    <p className={`text-xs font-bold uppercase tracking-wider ${filterType === 'ALL' ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
                    <p className="text-xl font-black mt-1">{formatRp(total)}</p>
                    <p className={`text-[10px] mt-1 ${filterType === 'ALL' ? 'text-gray-400' : 'text-gray-400'}`}>{expenses.length} catatan</p>
                </button>
                <button
                    onClick={() => setFilterType('EXPENSE')}
                    className={`p-4 rounded-2xl border transition-all text-left ${filterType === 'EXPENSE' ? 'bg-red-50 border-red-200 shadow-md' : 'bg-white border-gray-200 hover:border-red-200'}`}
                >
                    <div className="flex items-center gap-2">
                        <ArrowUpCircle size={16} className="text-red-500" />
                        <p className="text-xs font-bold uppercase tracking-wider text-red-600">Pengeluaran</p>
                    </div>
                    <p className="text-xl font-black mt-1 text-red-700">{formatRp(expenseTotal)}</p>
                    <p className="text-[10px] text-red-400 mt-1">{expenses.filter(e => !e.type || e.type === 'EXPENSE').length} catatan</p>
                </button>
                <button
                    onClick={() => setFilterType('PURCHASE')}
                    className={`p-4 rounded-2xl border transition-all text-left ${filterType === 'PURCHASE' ? 'bg-orange-50 border-orange-200 shadow-md' : 'bg-white border-gray-200 hover:border-orange-200'}`}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={16} className="text-orange-500" />
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Pembelian</p>
                    </div>
                    <p className="text-xl font-black mt-1 text-orange-700">{formatRp(purchaseTotal)}</p>
                    <p className="text-[10px] text-orange-400 mt-1">{expenses.filter(e => e.type === 'PURCHASE').length} catatan</p>
                </button>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200">
                    <Calendar size={16} className="text-gray-400" />
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm font-medium text-gray-700 outline-none" />
                    <span className="text-gray-400">—</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm font-medium text-gray-700 outline-none" />
                </div>
                <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
                    <span className="text-sm font-bold text-red-600">Filtered: {formatRp(filteredTotal)}</span>
                </div>
            </div>

            {/* Add Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                    <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                        <h2 className="text-lg font-bold text-gray-800">Tambah Pengeluaran</h2>

                        {/* Type selector */}
                        <div className="grid grid-cols-2 gap-3">
                            {EXPENSE_TYPES.map(t => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setForm({ ...form, type: t.value })}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                                        form.type === t.value
                                            ? t.color === 'red' ? 'border-red-500 bg-red-50 text-red-700' : 'border-orange-500 bg-orange-50 text-orange-700'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}
                                >
                                    <t.icon size={18} />
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <input required placeholder="Deskripsi" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                        <input required type="number" placeholder="Jumlah (Rp)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none">
                            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                            <button type="submit" className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800">Simpan</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Expenses Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="text-center py-20 text-gray-400"><Wallet size={48} className="mx-auto mb-3 opacity-50" /><p className="font-medium">Belum ada pengeluaran</p></div>
                ) : (
                    <table className="w-full">
                        <thead><tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Tanggal</th>
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Deskripsi</th>
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Tipe</th>
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Kategori</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Jumlah</th>
                            <th className="px-6 py-3.5"></th>
                        </tr></thead>
                        <tbody>
                            {filteredExpenses.map(e => (
                                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(e.createdAt).toLocaleDateString('id-ID')}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{e.description}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                            e.type === 'PURCHASE'
                                                ? 'bg-orange-50 text-orange-600 border border-orange-100'
                                                : 'bg-red-50 text-red-600 border border-red-100'
                                        }`}>
                                            {e.type === 'PURCHASE' ? <ShoppingBag size={12} /> : <ArrowUpCircle size={12} />}
                                            {e.type === 'PURCHASE' ? 'Pembelian' : 'Pengeluaran'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">{e.category}</span></td>
                                    <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">{formatRp(Number(e.amount))}</td>
                                    <td className="px-6 py-4 text-right"><button onClick={() => handleDelete(e.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
