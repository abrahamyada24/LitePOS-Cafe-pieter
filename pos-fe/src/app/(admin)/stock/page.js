"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, ArrowDownRight, ArrowUpRight, AlertTriangle, 
    Search, Filter, Calendar, Package, Loader2, ArrowRightLeft 
} from 'lucide-react';
import StockModal from '@/components/StockModal';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function InventoryPage() {
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL'); 
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const [historyRes, productRes] = await Promise.all([
            fetch(`${API_URL}/api/inventory/history`, { headers }),
            fetch(`${API_URL}/api/products`, { headers })
        ]);

        const historyData = await historyRes.json();
        const productData = await productRes.json();

        if (historyData.success) setLogs(historyData.data);
        if (productData.success) setProducts(productData.data);

    } catch (error) {
        console.error("Gagal load inventory:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = useMemo(() => {
      return logs.filter(log => {
          const matchType = filterType === 'ALL' || log.type === filterType;
          const matchSearch = log.product?.name.toLowerCase().includes(search.toLowerCase()) || 
                              log.description?.toLowerCase().includes(search.toLowerCase());
          return matchType && matchSearch;
      });
  }, [logs, filterType, search]);

  const handleSaveAdjustment = async (formData) => {
      try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_URL}/api/inventory/adjustment`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(formData)
          });

          const data = await res.json();
          if (!data.success) throw new Error(data.message);

          showAlert.success('Stok diperbarui', 'Perubahan stok berhasil disimpan.');
          setIsModalOpen(false);
          fetchData();

      } catch (error) {
          showAlert.error('Gagal memperbarui stok', error.message);
      }
  };

  const formatDate = (dateString) => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
      }).format(date);
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Riwayat Stok</h2>
          <p className="text-gray-400 text-sm">Monitor pergerakan barang masuk & keluar.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow-lg shadow-blue-200 transition-colors font-medium"
        >
           <ClipboardList size={18} /> Stock Opname
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
             {['ALL', 'IN', 'OUT'].map((type) => (
                 <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        filterType === type 
                        ? 'bg-white text-gray-800 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                 >
                    {type === 'ALL' ? 'Semua' : type === 'IN' ? 'Masuk' : 'Keluar'}
                 </button>
             ))}
          </div>

          <div className="relative group w-full sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
             <input 
                type="text" 
                placeholder="Cari produk atau keterangan..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm w-full focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all outline-none"
             />
          </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Waktu</th>
                  <th className="px-6 py-4 font-semibold">Produk</th>
                  <th className="px-6 py-4 font-semibold">Tipe</th>
                  <th className="px-6 py-4 font-semibold">Qty</th>
                  <th className="px-6 py-4 font-semibold">Sumber</th>
                  <th className="px-6 py-4 font-semibold">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                    <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                            <div className="flex justify-center items-center gap-2">
                                <Loader2 className="animate-spin" size={20}/> Memuat data...
                            </div>
                        </td>
                    </tr>
                ) : filteredLogs.length === 0 ? (
                    <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-400">Tidak ada riwayat stok.</td>
                    </tr>
                ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap font-mono">
                            {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-800">
                            {log.product?.name || 'Produk Dihapus'}
                            <span className="block text-[10px] text-gray-400 font-normal">{log.product?.sku}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1 w-fit px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
                             log.type === 'IN' 
                                ? 'bg-green-50 text-green-600 border border-green-100' 
                                : 'bg-red-50 text-red-600 border border-red-100'
                          }`}>
                             {log.type === 'IN' ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>}
                             {log.type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 font-black text-base ${log.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                          {log.type === 'IN' ? '+' : '-'}{log.qty}
                        </td>
                        <td className="px-6 py-4">
                             <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600 border border-gray-200">
                                 {log.source}
                             </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs italic max-w-xs truncate">
                            {log.description}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
        </div>
      </div>

      <StockModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAdjustment}
        products={products}
      />
    </div>
  );
}
