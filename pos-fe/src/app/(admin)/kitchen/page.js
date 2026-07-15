"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock3, Flame, CheckCircle2, Loader2, RefreshCw, X, History } from 'lucide-react';
import { showAlert } from '@/utils/swal';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_URL = RAW_API_URL.replace(/\/api$/, '').replace(/\/$/, '');

const STATUS_META = {
    NEW: { label: 'Baru', icon: Clock3, accent: 'border-amber-300', button: 'Mulai masak', next: 'PREPARING' },
    PREPARING: { label: 'Diproses', icon: Flame, accent: 'border-blue-300', button: 'Tandai siap', next: 'READY' },
    READY: { label: 'Siap', icon: CheckCircle2, accent: 'border-emerald-300', button: 'Selesaikan', next: 'COMPLETED' },
    COMPLETED: { label: 'Selesai', icon: CheckCircle2, accent: 'border-gray-200' }
};

const formatRp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function KitchenPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [includeCompleted, setIncludeCompleted] = useState(false);
    const [now, setNow] = useState(Date.now());

    const loadOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/kitchen-orders?includeCompleted=${includeCompleted}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || data.error);
            setOrders(data.data || []);
        } catch (error) {
            if (!silent) showAlert.error('Gagal memuat antrean', error.message || 'Periksa koneksi backend.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [includeCompleted]);

    useEffect(() => {
        loadOrders();
        const poll = setInterval(() => loadOrders(true), 5000);
        const clock = setInterval(() => setNow(Date.now()), 30000);
        return () => { clearInterval(poll); clearInterval(clock); };
    }, [loadOrders]);

    const updateStatus = async (order, status) => {
        setUpdatingId(order.id);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/kitchen-orders/${order.id}/status`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || data.error);
            await loadOrders(true);
        } catch (error) {
            showAlert.error('Status belum berubah', error.message || 'Coba lagi.');
        } finally {
            setUpdatingId(null);
        }
    };

    const elapsed = (createdAt) => {
        const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
        return minutes < 60 ? `${minutes} mnt` : `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
    };

    const grouped = useMemo(() => Object.fromEntries(
        Object.keys(STATUS_META).map(status => [status, orders.filter(order => order.status === status)])
    ), [orders]);
    const visibleStatuses = includeCompleted ? ['NEW', 'PREPARING', 'READY', 'COMPLETED'] : ['NEW', 'PREPARING', 'READY'];

    return (
        <div className="space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-gray-950 text-white flex items-center justify-center"><ChefHat size={23} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Antrean Dapur</h1>
                        <p className="text-sm text-gray-500">Pesanan hari ini, urut nomor antrean</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIncludeCompleted(value => !value)} className={`h-10 px-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${includeCompleted ? 'bg-gray-950 text-white border-gray-950' : 'bg-white text-gray-600 border-gray-200'}`}>
                        <History size={15} /> Riwayat
                    </button>
                    <button onClick={() => loadOrders()} className="w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-600 flex items-center justify-center" title="Muat ulang">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="h-72 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" size={30} /></div>
            ) : (
                <div className={`grid grid-cols-1 ${includeCompleted ? 'xl:grid-cols-4' : 'lg:grid-cols-3'} gap-4 items-start`}>
                    {visibleStatuses.map(status => {
                        const meta = STATUS_META[status];
                        const StatusIcon = meta.icon;
                        return (
                            <section key={status} className="min-w-0">
                                <div className="h-11 flex items-center justify-between border-b border-gray-200 mb-3">
                                    <div className="flex items-center gap-2 font-black text-sm text-gray-800"><StatusIcon size={17} /> {meta.label}</div>
                                    <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-xs font-black flex items-center justify-center">{grouped[status].length}</span>
                                </div>
                                <div className="space-y-3">
                                    {grouped[status].length === 0 && <p className="py-12 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">Tidak ada pesanan</p>}
                                    {grouped[status].map(order => (
                                        <article key={order.id} className={`bg-white border-2 ${meta.accent} rounded-lg p-4 shadow-sm`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-2xl font-black text-gray-950">{order.queueLabel}</span>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-sm text-gray-800 truncate">{order.tableNumber ? `Meja ${order.tableNumber}` : 'Kasir'}</p>
                                                        <p className="text-[11px] text-gray-500 truncate">{order.customerName || order.source}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 flex items-center gap-1 shrink-0"><Clock3 size={12} /> {elapsed(order.createdAt)}</span>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                                {order.items.map((item, index) => (
                                                    <div key={`${item.productId || item.packageId || index}-${index}`}>
                                                        <div className="flex gap-2 text-sm"><span className="font-black text-gray-950 shrink-0">{item.qty || item.quantity}x</span><span className="font-bold text-gray-700">{item.name}</span></div>
                                                        {item.components?.length > 0 && <p className="pl-7 text-[11px] text-gray-500">{item.components.map(component => `${component.name} x${component.qty}`).join(', ')}</p>}
                                                        {item.notes && <p className="pl-7 text-[11px] font-bold text-amber-700">{item.notes}</p>}
                                                    </div>
                                                ))}
                                            </div>

                                            {order.note && <p className="mt-3 p-2 rounded-md bg-amber-50 text-xs font-bold text-amber-800">{order.note}</p>}
                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                <span className="text-xs font-black text-gray-600">{formatRp(order.total)}</span>
                                                {meta.next && (
                                                    <div className="flex gap-2">
                                                        {status !== 'READY' && <button onClick={() => updateStatus(order, 'CANCELLED')} disabled={updatingId === order.id} className="w-9 h-9 rounded-lg border border-red-100 text-red-500 flex items-center justify-center" title="Batalkan"><X size={15} /></button>}
                                                        <button onClick={() => updateStatus(order, meta.next)} disabled={updatingId === order.id} className="h-9 px-3 rounded-lg bg-gray-950 text-white text-xs font-black disabled:opacity-50">{updatingId === order.id ? '...' : meta.button}</button>
                                                    </div>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
