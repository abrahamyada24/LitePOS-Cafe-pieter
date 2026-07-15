"use client";
import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function StockOpnamePage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [results, setResults] = useState([]);

    const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/stock-opname`, { headers: headers() });
            const data = await res.json();
            if (data.success) setProducts(data.data.map(p => ({ ...p, physicalQty: '' })));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadProducts(); }, []);

    const updatePhysical = (id, val) => {
        setProducts(products.map(p => p.id === id ? { ...p, physicalQty: val } : p));
    };

    const handleSubmit = async () => {
        const items = products
            .filter(p => p.physicalQty !== '' && !p.isUnlimitedStock)
            .map(p => ({ productId: p.id, physicalQty: parseInt(p.physicalQty) }));

        if (items.length === 0) return showAlert.warning('Stok fisik kosong', 'Isi stok fisik minimal 1 produk.');
        const confirmed = await showAlert.confirm(
            'Simpan stock opname?',
            `${items.length} produk akan disesuaikan dengan stok fisik.`,
            'Ya, Simpan'
        );
        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/stock-opname`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ items })
            });
            const data = await res.json();
            if (data.success) { setDone(true); setResults(data.data); }
            else showAlert.error('Stock opname gagal', data.error || data.message);
        } catch (e) { showAlert.error('Stock opname gagal', e.message || 'Coba lagi.'); }
        setSaving(false);
    };

    if (done) {
        return (
            <div className="space-y-6">
                <div className="text-center py-10">
                    <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
                    <h2 className="text-2xl font-extrabold text-gray-800">Stock Opname Selesai</h2>
                    <p className="text-sm text-gray-500 mt-2">{results.length} produk diperbarui</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead><tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Produk</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Stok Sistem</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Stok Fisik</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Selisih</th>
                        </tr></thead>
                        <tbody>
                            {results.map(r => (
                                <tr key={r.productId} className="border-b border-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{r.productName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{r.systemStock}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{r.physicalQty}</td>
                                    <td className={`px-6 py-4 text-sm font-bold text-right ${r.difference > 0 ? 'text-green-600' : r.difference < 0 ? 'text-red-600' : 'text-gray-400'}`}>{r.difference > 0 ? '+' : ''}{r.difference}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={() => { setDone(false); loadProducts(); }} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800">Opname Baru</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Stock Opname</h1>
                    <p className="text-sm text-gray-500 mt-1">Bandingkan stok fisik vs stok sistem</p>
                </div>
                <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan Opname
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
                ) : (
                    <table className="w-full">
                        <thead><tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Produk</th>
                            <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Kategori</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Stok Sistem</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Stok Fisik</th>
                            <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase">Selisih</th>
                        </tr></thead>
                        <tbody>
                            {products.map(p => {
                                const diff = p.physicalQty !== '' ? parseInt(p.physicalQty) - p.systemStock : null;
                                return (
                                    <tr key={p.id} className={`border-b border-gray-50 ${p.isUnlimitedStock ? 'opacity-40' : ''}`}>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                            <p className="text-xs text-gray-400">{p.sku}{p.barcode ? ` | ${p.barcode}` : ''}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{p.categoryName}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-700 text-right">{p.isUnlimitedStock ? '∞' : p.systemStock}</td>
                                        <td className="px-6 py-4 text-right">
                                            {p.isUnlimitedStock ? <span className="text-xs text-gray-400">N/A</span> :
                                                <input type="number" value={p.physicalQty} onChange={e => updatePhysical(p.id, e.target.value)} placeholder="0" className="w-20 text-sm font-bold text-right border rounded-lg px-2 py-1.5 focus:border-blue-500 outline-none" />
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {diff !== null && (
                                                <span className={`text-sm font-bold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                    {diff === 0 ? '✓' : `${diff > 0 ? '+' : ''}${diff}`}
                                                    {diff !== 0 && <AlertTriangle size={12} className="inline ml-1" />}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
