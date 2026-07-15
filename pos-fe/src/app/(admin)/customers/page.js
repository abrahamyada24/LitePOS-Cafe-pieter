"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Crown, ShoppingBag, User } from 'lucide-react';
import { useStore } from '@/store/useStore';
import CustomerModal from '@/components/CustomerModal';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function CustomersPage() {
  const { customers, fetchDataMaster } = useStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    fetchDataMaster(); 
  }, []);

  const getImageUrl = (path) => {
      if (!path) return null;
      return path.startsWith('http') ? path : `${API_URL}${path}`;
  };

  const getSpanClass = (size) => {
    switch(size) {
        case 'large': return 'md:col-span-2 md:row-span-2';
        case 'tall': return 'md:col-span-1 md:row-span-2';
        case 'wide': return 'md:col-span-2 md:row-span-1';
        default: return 'md:col-span-1 md:row-span-1';
    }
  }

  const formatRp = (num) => (Number(num) || 0).toLocaleString('id-ID');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.memberId && c.memberId.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.phone && c.phone.includes(searchQuery))
  );


  const handleAdd = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (customer, e) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const confirmed = await showAlert.confirmDanger('Hapus pelanggan?', 'Data pelanggan akan dihapus permanen.', 'Ya, Hapus');
    if (confirmed) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/customers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || data.error);
            await fetchDataMaster();
            showAlert.success('Pelanggan dihapus', 'Data pelanggan berhasil dihapus.');
        } catch (error) {
            showAlert.error('Gagal menghapus pelanggan', error.message || 'Coba lagi.');
        }
    }
  };

const handleSaveCustomer = async (formData) => {
    const token = localStorage.getItem('token');
    const data = new FormData();
    data.append('name', formData.name);
    data.append('phone', formData.phone);
    data.append('email', formData.email);
    data.append('displayType', formData.displayType);
    if (formData.imageFile) {
        data.append('image', formData.imageFile);
    }

    try {
        const url = editingCustomer 
            ? `${API_URL}/api/customers/${editingCustomer.id}` 
            : `${API_URL}/api/customers`;
        
        const method = editingCustomer ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: data
        });

        const json = await res.json();

        if (!res.ok) {
            throw new Error(json.message || json.error || "Gagal menyimpan");
        }
        
        fetchDataMaster(); 
        setIsModalOpen(false);
    } catch (error) {
        showAlert.error('Gagal menyimpan pelanggan', error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div>
           <h2 className="text-2xl font-bold text-gray-800">Pelanggan & Member</h2>
           <p className="text-gray-400 text-sm">Database pelanggan setia toko Anda.</p>
         </div>
         
         <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Cari nama / HP / ID..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm"
                />
            </div>
            <button 
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow-sm transition-colors whitespace-nowrap"
            >
                <Plus size={18} /> <span className="hidden sm:inline">Tambah</span>
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[200px] gap-4">
        <div 
            onClick={handleAdd}
            className="md:col-span-1 md:row-span-1 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer bg-gray-50/50 group"
        >
            <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                <User size={24} />
            </div>
            <span className="font-medium text-sm">Registrasi Member</span>
        </div>

        {filteredCustomers.map((customer) => (
          <div 
            key={customer.id} 
            className={`group relative rounded-3xl overflow-hidden border border-gray-100 bg-white hover:shadow-xl transition-all duration-300 cursor-pointer ${getSpanClass(customer.displayType)}`}
          >
            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => handleEdit(customer, e)}
                    className="p-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:text-blue-500 shadow-sm hover:bg-white transition-colors"
                >
                    <Edit size={16} />
                </button>
                <button 
                    onClick={(e) => handleDelete(customer.id, e)}
                    className="p-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-500 shadow-sm hover:bg-white transition-colors"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {customer.displayType === 'large' ? (
                <>
                    <div className="absolute inset-0">
                        {customer.imageUrl ? (
                            <img src={getImageUrl(customer.imageUrl)} alt={customer.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center"><User size={48} className="text-gray-400"/></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    </div>
                    {customer.totalSpent > 1000000 && (
                        <div className="absolute top-4 left-4">
                            <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-blue-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1 border border-white/20">
                                <Crown size={12} fill="currentColor" /> VIP MEMBER
                            </span>
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 p-6 pb-8 text-white w-full">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-blue-300 font-medium text-xs mb-1 uppercase tracking-wider">{customer.memberId}</p>
                                <h3 className="text-3xl font-bold mb-2 leading-tight">{customer.name}</h3>
                                <p className="text-sm text-gray-300">{customer.phone}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400 mb-1">Total Belanja</p>
                                <p className="text-xl font-bold text-white">Rp {formatRp(customer.totalSpent)}</p>
                                <p className="text-xs text-yellow-400 mt-1 flex justify-end items-center gap-1"><Crown size={12}/> {customer.points || 0} Poin</p>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="h-full flex flex-col p-5 pb-6">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                            {customer.imageUrl ? (
                                <img src={getImageUrl(customer.imageUrl)} alt={customer.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"><User size={20}/></div>
                            )}
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{customer.memberId}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center min-w-0">
                        <h3 className="font-bold text-gray-800 text-lg leading-tight truncate">{customer.name}</h3>
                        <p className="text-gray-400 text-xs mb-3 truncate">{customer.phone || '-'}</p>
                        
                        <div className="flex items-center gap-3 mt-auto pt-3 border-t border-gray-50">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-400 uppercase truncate">Visits</p>
                                <p className="font-bold text-gray-700 flex items-center gap-1 whitespace-nowrap">
                                    <ShoppingBag size={12} className="text-blue-500" /> {customer.totalVisits}x
                                </p>
                            </div>
                            <div className="flex-1 border-l border-gray-100 pl-3 min-w-0">
                                <p className="text-[10px] text-gray-400 uppercase truncate">Spent / Poin</p>
                                <p className="font-bold text-gray-700 text-xs whitespace-nowrap">
                                    Rp {formatRp(customer.totalSpent)}
                                </p>
                                <p className="text-[10px] text-orange-500 font-bold flex items-center gap-1 mt-0.5"><Crown size={10}/> {customer.points || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
        ))}
      </div>

      <CustomerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomer}
        initialData={editingCustomer}
      />
    </div>
  );
}
