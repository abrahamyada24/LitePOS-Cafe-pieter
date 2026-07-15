"use client";
import React, { useEffect, useState } from 'react';
import { PackageCheck, Plus, Minus, Trash2, Save, Loader2, Search } from 'lucide-react';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function StockReceivingPage() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState([]);
    const [tab, setTab] = useState('form');

    const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });
    const formatRp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/products`, { headers: headers() });
            const data = await res.json();
            if (data.success) setProducts(data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const loadHistory = async () => {
        try {
            const res = await fetch(`${API_URL}/api/stock-receipts`, { headers: headers() });
            const data = await res.json();
            if (data.success) setHistory(data.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { loadProducts(); loadHistory(); }, []);

    const addToCart = (product) => {
        if (cart.find(c => c.productId === product.id)) return;
        setCart([...cart, { productId: product.id, name: product.name, currentStock: product.stock, quantityAdded: 1, costPrice: Number(product.costPrice) || 0 }]);
    };

    const updateQty = (productId, qty) => {
        setCart(cart.map(c => c.productId === productId ? { ...c, quantityAdded: Math.max(1, qty) } : c));
    };

    const updateCost = (productId, cost) => {
        setCart(cart.map(c => c.productId === productId ? { ...c, costPrice: parseFloat(cost) || 0 } : c));
    };

    const removeFromCart = (productId) => setCart(cart.filter(c => c.productId !== productId));

    const handleSave = async () => {
        if (cart.length === 0) return showAlert.warning('Belum ada produk', 'Tambahkan produk terlebih dahulu.');
        setSaving(true);
        try {
            const user = (() => { try { return JSON.parse(localStorage.getItem('pos-store') || '{}')?.state?.user; } catch { return null; } })();
            const res = await fetch(`${API_URL}/api/stock-receipts`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ notes, createdBy: user?.name || 'Admin', items: cart })
            });
            const data = await res.json();
            if (data.success) { showAlert.success('Penerimaan tersimpan', 'Stok produk berhasil diperbarui.'); setCart([]); setNotes(''); loadProducts(); loadHistory(); }
            else showAlert.error('Gagal menyimpan penerimaan', data.error || data.message);
        } catch (e) { showAlert.error('Gagal menyimpan penerimaan', e.message || 'Coba lagi.'); }
        setSaving(false);
    };

    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Penerimaan Barang</h1>
                    <p className="text-sm text-gray-500 mt-1">Terima stok dari supplier, stok otomatis bertambah</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setTab('form')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'form' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>Form</button>
                    <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'history' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>Riwayat</button>
                </div>
            </div>

            {tab === 'form' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="relative">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none" />
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 max-h-[500px] overflow-y-auto">
                            {loading ? <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div> :
                                filtered.map(p => (
                                    <div key={p.id} onClick={() => addToCart(p)} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                                        <div><p className="text-sm font-bold text-gray-800">{p.name}</p><p className="text-xs text-gray-500">Stok: {p.stock} | HPP: {formatRp(Number(p.costPrice))}</p></div>
                                        <Plus size={18} className="text-gray-400" />
                                    </div>
                                ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                            <h3 className="font-bold text-gray-800">Daftar Penerimaan ({cart.length} item)</h3>
                            {cart.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center">Klik produk di sebelah kiri untuk menambahkan</p> :
                                cart.map(c => (
                                    <div key={c.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-800 truncate">{c.name}</p>
                                            <p className="text-xs text-gray-500">Stok saat ini: {c.currentStock}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => updateQty(c.productId, c.quantityAdded - 1)} className="p-1 rounded bg-gray-200 hover:bg-gray-300"><Minus size={14} /></button>
                                            <input type="number" value={c.quantityAdded} onChange={e => updateQty(c.productId, parseInt(e.target.value) || 1)} className="w-16 text-center text-sm font-bold border rounded-lg py-1" />
                                            <button onClick={() => updateQty(c.productId, c.quantityAdded + 1)} className="p-1 rounded bg-gray-200 hover:bg-gray-300"><Plus size={14} /></button>
                                        </div>
                                        <input type="number" value={c.costPrice} onChange={e => updateCost(c.productId, e.target.value)} placeholder="HPP" className="w-24 text-sm border rounded-lg px-2 py-1 text-right" />
                                        <button onClick={() => removeFromCart(c.productId)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            <textarea placeholder="Catatan (opsional)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none" rows={2} />
                            <button onClick={handleSave} disabled={saving || cart.length === 0} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan Penerimaan
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {history.length === 0 ? <div className="text-center py-20 text-gray-400"><PackageCheck size={48} className="mx-auto mb-3 opacity-50" /><p>Belum ada riwayat penerimaan</p></div> :
                        <table className="w-full">
                            <thead><tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Tanggal</th>
                                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Dibuat Oleh</th>
                                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Items</th>
                                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Catatan</th>
                            </tr></thead>
                            <tbody>
                                {history.map(r => (
                                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-6 py-4 text-sm text-gray-600">{new Date(r.receivedAt).toLocaleString('id-ID')}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-800">{r.createdBy || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{r.items?.map(i => `${i.productName || 'Product'} (+${i.quantityAdded})`).join(', ')}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{r.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>}
                </div>
            )}
        </div>
    );
}
