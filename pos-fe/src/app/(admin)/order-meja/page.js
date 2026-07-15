"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Clock3,
    Loader2,
    QrCode,
    RefreshCw,
    Settings2,
    Trash2,
    UtensilsCrossed,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { showAlert } from '@/utils/swal';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_URL = RAW_API_URL.replace(/\/api$/, '').replace(/\/$/, '');

const parsePayload = (cartData) => {
    try {
        const parsed = typeof cartData === 'string' ? JSON.parse(cartData) : cartData;
        if (!parsed || Array.isArray(parsed)) return null;
        if (parsed.source !== 'TABLE_QR' && !parsed.tableNumber) return null;
        return { ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] };
    } catch {
        return null;
    }
};

const formatRp = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;

const formatOrderTime = (value) => new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

const getOrderTotal = (order) => Number(order.payload.grandTotal || order.payload.items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || item.qty || 1),
    0
));

export default function OrderMejaPage() {
    const router = useRouter();
    const settings = useStore(state => state.settings);
    const fetchDataMaster = useStore(state => state.fetchDataMaster);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState(null);
    const [error, setError] = useState('');

    const loadOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/saved-transactions`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Order belum dapat dimuat.');

            const tableOrders = (data.data || []).flatMap(row => {
                const payload = parsePayload(row.cartData);
                return payload ? [{ ...row, payload }] : [];
            });
            tableOrders.sort((left, right) => {
                const dateOrder = String(left.payload.queueDate || left.createdAt).localeCompare(String(right.payload.queueDate || right.createdAt));
                return dateOrder
                    || Number(left.payload.queueNumber || Number.MAX_SAFE_INTEGER) - Number(right.payload.queueNumber || Number.MAX_SAFE_INTEGER)
                    || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            });
            setOrders(tableOrders);
            setError('');
        } catch (requestError) {
            if (!silent) setError(requestError.message || 'Order belum dapat dimuat.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!settings) fetchDataMaster();
    }, [fetchDataMaster, settings]);

    useEffect(() => {
        loadOrders();
        const interval = setInterval(() => loadOrders(true), 15000);
        return () => clearInterval(interval);
    }, [loadOrders]);

    const rejectOrder = async (order) => {
        const table = order.payload.tableNumber || 'tanpa nomor meja';
        const confirmed = await showAlert.confirmDanger(
            'Tolak order meja?',
            `${order.payload.queueLabel || order.name} dari Meja ${table} akan dibatalkan dan dipindahkan ke riwayat dapur.`,
            'Ya, Tolak Order'
        );
        if (!confirmed) return;

        setWorkingId(order.id);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/saved-transactions/${order.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || data.error);
            setOrders(current => current.filter(item => item.id !== order.id));
            showAlert.success('Order ditolak', `${order.payload.queueLabel || order.name} telah dibatalkan.`);
        } catch (requestError) {
            showAlert.error('Order belum ditolak', requestError.message || 'Coba lagi.');
        } finally {
            setWorkingId(null);
        }
    };

    const processOrder = async (order) => {
        const activeOrderId = sessionStorage.getItem('table-order-accepted-id');
        if (activeOrderId && activeOrderId !== String(order.id)) {
            showAlert.warning('Masih ada order aktif', 'Selesaikan order meja yang sedang terbuka di kasir sebelum menerima order berikutnya.');
            return;
        }
        const confirmed = await showAlert.confirm(
            'Proses order di kasir?',
            `${order.payload.queueLabel || order.name} akan diterima dan isi pesanannya dibuka di POS.`,
            'Ya, Proses di Kasir'
        );
        if (!confirmed) return;

        setWorkingId(order.id);
        sessionStorage.removeItem('table-order-accepted-id');
        sessionStorage.setItem('table-order-to-process', JSON.stringify(order));
        router.push('/pos');
    };

    const nextQueue = useMemo(() => orders[0]?.payload.queueLabel || '-', [orders]);

    if (settings && !settings.enableTableOrder) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-full max-w-md border border-gray-200 bg-white rounded-lg p-6 text-center">
                    <QrCode size={34} className="mx-auto text-gray-400" />
                    <h1 className="mt-4 text-xl font-black text-gray-900">Order meja tidak aktif</h1>
                    <p className="mt-2 text-sm text-gray-500">Aktifkan fitur Order Meja via QR dari Pengaturan.</p>
                    <Link href="/settings" className="mt-5 h-11 px-4 rounded-lg bg-gray-950 text-white font-bold inline-flex items-center gap-2">
                        <Settings2 size={16} /> Buka Pengaturan
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Order Meja</h1>
                    <p className="text-sm text-gray-500">Pesanan QR pelanggan, sama dengan antrean Order Meja Android</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/tables" className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-bold flex items-center gap-2">
                        <QrCode size={15} /> QR Meja
                    </Link>
                    <button onClick={() => loadOrders()} className="w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-600 flex items-center justify-center" title="Muat ulang">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </header>

            <section className="bg-gray-950 text-white rounded-lg px-5 py-4 flex items-center gap-5">
                <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Menunggu</p>
                    <p className="text-3xl font-black mt-1">{orders.length}</p>
                </div>
                <div className="w-px h-12 bg-gray-700" />
                <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Berikutnya</p>
                    <p className="text-3xl font-black mt-1 text-emerald-400">{nextQueue}</p>
                </div>
                <UtensilsCrossed size={28} className="text-gray-500 hidden sm:block" />
            </section>

            {loading ? (
                <div className="h-72 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" size={30} /></div>
            ) : orders.length === 0 ? (
                <div className="min-h-72 border border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-center px-6">
                    <div className="w-14 h-14 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center"><UtensilsCrossed size={27} /></div>
                    <h2 className="mt-4 font-black text-gray-800">Belum ada order masuk</h2>
                    <p className={`mt-1 text-sm ${error ? 'text-red-500' : 'text-gray-500'}`}>{error || 'Daftar diperbarui otomatis setiap 15 detik.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {orders.map((order, index) => (
                        <article key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="p-4 flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">Meja {order.payload.tableNumber || '-'}</span>
                                        <span className="text-[11px] font-bold text-gray-400 truncate">{order.payload.orderCode}</span>
                                    </div>
                                    <h2 className="mt-2 font-black text-gray-900">{order.payload.customerName || 'Pelanggan'}</h2>
                                    <p className="mt-1 text-xs text-gray-500 flex items-center gap-1"><Clock3 size={12} /> {formatOrderTime(order.createdAt)}</p>
                                    <p className="mt-1 text-xs font-bold text-amber-600">Urutan {index + 1} dari {orders.length} menunggu</p>
                                </div>
                                <div className="min-w-20 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-center">
                                    <p className="text-[9px] font-black uppercase text-blue-500">Antrean</p>
                                    <p className="text-lg font-black text-blue-700">{order.payload.queueLabel || 'Lama'}</p>
                                </div>
                            </div>

                            <div className="mx-4 py-3 border-t border-gray-100 space-y-2">
                                {order.payload.items.map((item, itemIndex) => {
                                    const qty = Number(item.quantity || item.qty || 1);
                                    return (
                                        <div key={`${item.productId || item.packageId || item.id}-${itemIndex}`} className="flex items-start gap-2 text-sm">
                                            <span className="w-8 shrink-0 font-black text-gray-800">{qty}x</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-800">{item.name}</p>
                                                {item.notes && <p className="text-xs text-amber-700 mt-0.5">{item.notes}</p>}
                                            </div>
                                            <span className="text-xs font-bold text-gray-600 shrink-0">{formatRp(Number(item.price || 0) * qty)}</span>
                                        </div>
                                    );
                                })}
                                {order.payload.note && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{order.payload.note}</p>}
                            </div>

                            <footer className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold uppercase text-gray-400">Total</p>
                                    <p className="font-black text-gray-900">{formatRp(getOrderTotal(order))}</p>
                                </div>
                                <button onClick={() => rejectOrder(order)} disabled={workingId === order.id} className="h-11 px-3 rounded-lg border border-red-200 text-red-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 disabled:opacity-50">
                                    <Trash2 size={16} /> Tolak
                                </button>
                                <button onClick={() => processOrder(order)} disabled={workingId === order.id} className="h-11 px-4 rounded-lg bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                                    Proses di Kasir <ArrowRight size={16} />
                                </button>
                            </footer>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
