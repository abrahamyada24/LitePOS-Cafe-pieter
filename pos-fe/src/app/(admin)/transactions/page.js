"use client";

import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, RefreshCw, Calendar as CalendarIcon, Loader2, PackageCheck } from 'lucide-react';
// Import modal dari folder components
import TransactionDetailModal from '../../../components/TransactionDetailModal';
import { showAlert } from '../../../utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [preOrderFilter, setPreOrderFilter] = useState(false);

    const fetchTransactions = async (page = 1) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            const params = new URLSearchParams({
                page: page,
                limit: 10,
            });

            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            if (startDate && endDate) {
                params.append('startDate', startDate);
                params.append('endDate', endDate);
            }
            if (preOrderFilter) {
                params.append('preOrder', 'true');
            }

            const res = await fetch(`${API_URL}/api/transactions?${params.toString()}`, { headers });
            const json = await res.json();

            if (json.success) {
                setTransactions(json.data);
                setMeta(json.meta || { page: 1, totalPages: 1, total: 0 });
            }
        } catch (error) {
            console.error("Gagal load transaksi:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTransactions(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, statusFilter, startDate, endDate, preOrderFilter]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= meta.totalPages) {
            fetchTransactions(newPage);
        }
    };

    const handleOpenDetail = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/transactions/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success) {
                setSelectedTransaction(json.data);
                setIsModalOpen(true);
            }
        } catch (error) {
            console.error(error);
            showAlert.error('Gagal memuat transaksi', 'Detail transaksi belum dapat ditampilkan.');
        }
    };

    const formatRp = (num) => "Rp " + (Number(num) || 0).toLocaleString('id-ID');
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="space-y-6">
            {/* Header Filter Bar */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex gap-6 overflow-x-auto pb-2 sm:pb-0 items-center">
                    <div className="px-2">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Data</p>
                        <p className="text-xl font-black text-gray-800">{meta.total} <span className="text-sm font-normal text-gray-400">Transaksi</span></p>
                    </div>
                    <div className="h-8 w-[1px] bg-gray-200"></div>
                    <div className="px-2">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Status</p>
                        <p className="text-sm font-medium text-gray-600 flex items-center gap-1">
                            {statusFilter ? statusFilter : 'Semua'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {/* Date Filter */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        <CalendarIcon size={14} className="text-gray-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-xs outline-none w-24 text-gray-600"
                        />
                        <span className="text-gray-300">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-xs outline-none w-24 text-gray-600"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    >
                        <option value="">Semua Status</option>
                        <option value="PAID">Lunas (PAID)</option>
                        <option value="PENDING">Pending</option>
                        <option value="CANCELLED">Batal</option>
                    </select>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Cari Invoice..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 w-40 sm:w-auto"
                        />
                    </div>

                    <button onClick={() => fetchTransactions(1)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                        <RefreshCw size={18} />
                    </button>

                    <button 
                        onClick={() => setPreOrderFilter(!preOrderFilter)} 
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                            preOrderFilter 
                                ? 'bg-purple-50 text-purple-600 border-purple-200' 
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <PackageCheck size={16} />
                        Pre-Order
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">No</th>
                                <th className="px-6 py-4 font-semibold">Invoice</th>
                                <th className="px-6 py-4 font-semibold">Waktu</th>
                                <th className="px-6 py-4 font-semibold">Tipe Pesanan</th>
                                <th className="px-6 py-4 font-semibold">Pelanggan</th>
                                <th className="px-6 py-4 font-semibold">Total</th>
                                <th className="px-6 py-4 font-semibold">Metode</th>
                                <th className="px-6 py-4 font-semibold">Pre-Order</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="animate-spin" size={20} /> Memuat data...
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-gray-400">Tidak ada transaksi ditemukan.</td>
                                </tr>
                            ) : (
                                transactions.map((trx, index) => (
                                    <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-400 text-xs">
                                            {(meta.page - 1) * 10 + index + 1}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-800 font-mono text-xs">
                                            {trx.invoiceNumber}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                                            {formatDate(trx.createdAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap ${trx.orderType === 'DINE_IN' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                {trx.orderType === 'DINE_IN' ? `DINE-IN (Meja ${trx.tableNumber || '-'})` : 'TAKE AWAY'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-800 font-medium text-xs">
                                            {trx.customer ? trx.customer.name : 'Umum'}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 text-xs">
                                            {formatRp(trx.grandTotal)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase border border-gray-200">
                                                {trx.payments?.[0]?.paymentType || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {trx.preOrderDate ? (
                                                <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-[10px] font-bold border border-purple-100">
                                                    {new Date(trx.preOrderDate).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${trx.status === 'PAID' ? 'bg-green-50 text-green-600 border-green-100' :
                                                trx.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                    'bg-red-50 text-red-600 border-red-100'
                                                }`}>
                                                {trx.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleOpenDetail(trx.id)}
                                                className="text-gray-400 hover:text-blue-500 font-medium p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <span className="text-xs text-gray-500">
                        Menampilkan halaman <span className="font-bold text-gray-800">{meta.page}</span> dari {meta.totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(meta.page - 1)}
                            disabled={meta.page === 1}
                            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => handlePageChange(meta.page + 1)}
                            disabled={meta.page === meta.totalPages}
                            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <TransactionDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transaction={selectedTransaction}
            />
        </div>
    );
}
