"use client";

import React, { useEffect, useState } from 'react';
import { X, Clock, Play, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SavedTransactionModal({ isOpen, onClose, onResume, formatNumber }) {
    const [savedTransactions, setSavedTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadSavedTransactions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
            const res = await fetch(`${baseUrl}/api/saved-transactions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSavedTransactions(data.data);
            }
        } catch (error) {
            console.error("Failed to load saved transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadSavedTransactions();
        }
    }, [isOpen]);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        const confirmed = await showAlert.confirmDanger(
            'Hapus transaksi tersimpan?',
            'Pesanan yang belum diselesaikan akan dibatalkan.',
            'Ya, Hapus'
        );
        if (!confirmed) return;
        
        try {
            const token = localStorage.getItem('token');
            const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
            const res = await fetch(`${baseUrl}/api/saved-transactions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || data.error);
            await loadSavedTransactions();
            showAlert.success('Transaksi dihapus', 'Pesanan tersimpan berhasil dibatalkan.');
        } catch (error) {
            showAlert.error('Gagal menghapus transaksi', error.message || 'Coba lagi.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Clock className="text-blue-500" />
                            Transaksi Tersimpan
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Lanjutkan transaksi yang ditunda sebelumnya</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p>Memuat data...</p>
                        </div>
                    ) : savedTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <ShoppingCart size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-600">Tidak Ada Transaksi</h3>
                            <p className="text-sm mt-1 max-w-xs">Belum ada transaksi yang disimpan. Anda dapat menyimpan transaksi dari keranjang kasir.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {savedTransactions.map((tx) => {
                                const parsed = JSON.parse(tx.cartData);
                                const payload = Array.isArray(parsed) ? { items: parsed } : parsed;
                                const cartData = Array.isArray(payload.items) ? payload.items : [];
                                const itemCount = cartData.reduce((sum, item) => sum + Number(item.qty || item.quantity || 1), 0);
                                const total = Number(payload.grandTotal || tx.total || cartData.reduce(
                                    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || item.quantity || 1),
                                    0
                                ));
                                
                                return (
                                    <div 
                                        key={tx.id} 
                                        className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                                        onClick={() => onResume(tx)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-bold text-gray-800 text-lg">{tx.name}</h3>
                                                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                                                        {new Date(tx.createdAt).toLocaleString('id-ID', {
                                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-1">
                                                    {cartData.map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join(', ')}
                                                </p>
                                                
                                                <div className="flex items-center gap-4 mt-3">
                                                    <div className="text-sm">
                                                        <span className="text-gray-500">Item:</span>
                                                        <span className="font-bold text-gray-700 ml-1">{itemCount}</span>
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="text-gray-500">Total:</span>
                                                        <span className="font-bold text-blue-600 ml-1">{formatNumber(total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2 ml-4">
                                                <button 
                                                    onClick={(e) => handleDelete(tx.id, e)}
                                                    className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                                <button 
                                                    onClick={() => onResume(tx)}
                                                    className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all flex items-center gap-2 font-bold"
                                                >
                                                    <Play size={18} />
                                                    <span className="hidden sm:inline">Lanjutkan</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
