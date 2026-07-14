"use client";
import React, { useEffect, useState } from 'react';
import { UtensilsCrossed, Plus, Trash2, Loader2, Edit2, QrCode } from 'lucide-react';
import { useStore } from '../../../store/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const STATUS_COLORS = {
    AVAILABLE: 'bg-green-100 text-green-700 border-green-200',
    OCCUPIED: 'bg-red-100 text-red-700 border-red-200',
    RESERVED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    CLEANING: 'bg-blue-100 text-blue-700 border-blue-200'
};

export default function TablesPage() {
    const enableTableOrder = useStore(state => state.settings?.enableTableOrder);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ number: '', name: '', capacity: '4' });

    const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

    const loadTables = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/tables`, { headers: headers() });
            const data = await res.json();
            if (data.success) setTables(data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadTables(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editId ? `${API_URL}/api/tables/${editId}` : `${API_URL}/api/tables`;
            const method = editId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
            const data = await res.json();
            if (data.success) { setShowForm(false); setEditId(null); setForm({ number: '', name: '', capacity: '4' }); loadTables(); }
            else alert(data.message);
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus meja ini?')) return;
        try {
            await fetch(`${API_URL}/api/tables/${id}`, { method: 'DELETE', headers: headers() });
            loadTables();
        } catch (e) { console.error(e); }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await fetch(`${API_URL}/api/tables/${id}/status`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ status }) });
            loadTables();
        } catch (e) { console.error(e); }
    };

    const openEdit = (table) => {
        setEditId(table.id);
        setForm({ number: table.number, name: table.name || '', capacity: String(table.capacity) });
        setShowForm(true);
    };

    const copyTableOrderLink = async (tableNumber) => {
        if (typeof window === 'undefined') return;
        const url = `${window.location.origin}/katalog?table=${encodeURIComponent(tableNumber)}`;
        try {
            await navigator.clipboard.writeText(url);
            alert(`Link order meja ${tableNumber} disalin.`);
        } catch {
            window.prompt('Salin link order meja:', url);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Manajemen Meja</h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola meja dine-in dan status ketersediaan</p>
                </div>
                <button onClick={() => { setEditId(null); setForm({ number: '', name: '', capacity: '4' }); setShowForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-lg">
                    <Plus size={18} /> Tambah Meja
                </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                {['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'].map(s => (
                    <div key={s} className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${s === 'AVAILABLE' ? 'bg-green-500' : s === 'OCCUPIED' ? 'bg-red-500' : s === 'RESERVED' ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
                        <span className="text-xs font-medium text-gray-600">{s} ({tables.filter(t => t.status === s).length})</span>
                    </div>
                ))}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                    <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                        <h2 className="text-lg font-bold text-gray-800">{editId ? 'Edit Meja' : 'Tambah Meja Baru'}</h2>
                        <input required placeholder="Nomor Meja (mis. T01)" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                        <input placeholder="Nama Area (opsional)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                        <input type="number" placeholder="Kapasitas" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                            <button type="submit" className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800">Simpan</button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
            ) : tables.length === 0 ? (
                <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100"><UtensilsCrossed size={48} className="mx-auto mb-3 opacity-50" /><p className="font-medium">Belum ada meja. Klik "Tambah Meja" untuk memulai.</p></div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {tables.map(t => (
                        <div key={t.id} className={`rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${STATUS_COLORS[t.status] || 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl font-black">{t.number}</span>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-white/50"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-white/50"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            {t.name && <p className="text-xs font-medium mb-2 opacity-80">{t.name}</p>}
                            <p className="text-xs opacity-70 mb-3">{t.capacity} kursi</p>
                            <select value={t.status} onChange={e => handleStatusChange(t.id, e.target.value)} className="w-full text-xs font-bold rounded-lg px-2 py-1.5 bg-white/60 border-none outline-none cursor-pointer">
                                <option value="AVAILABLE">Available</option>
                                <option value="OCCUPIED">Occupied</option>
                                <option value="RESERVED">Reserved</option>
                                <option value="CLEANING">Cleaning</option>
                            </select>
                            {enableTableOrder && (
                                <button
                                    onClick={() => copyTableOrderLink(t.number)}
                                    className="mt-2 w-full text-xs font-bold rounded-lg px-2 py-1.5 bg-white/70 hover:bg-white flex items-center justify-center gap-1.5"
                                >
                                    <QrCode size={13} /> Salin Link QR
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
