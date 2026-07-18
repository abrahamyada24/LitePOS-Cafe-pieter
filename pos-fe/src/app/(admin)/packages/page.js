/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package as PackageIcon, EyeOff, Eye } from 'lucide-react';
import { showAlert } from '@/utils/swal';
import { useStore } from '@/store/useStore';
import PackageModal from '@/components/PackageModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PackagesPage() {
    const { token } = useStore();
    const [packages, setPackages] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPackages = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`${API_URL}/api/packages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.success) {
                setPackages(result.data);
            }
        } catch (error) {
            showAlert.error("Error", "Gagal mengambil data paket");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchPackages();
    }, [token]);

    const handleSave = async (formData) => {
        try {
            const isEditing = !!selectedPackage;
            const url = isEditing
                ? `${API_URL}/api/packages/${selectedPackage.id}`
                : `${API_URL}/api/packages`;
            const method = isEditing ? 'PUT' : 'POST';

            const payload = new FormData();
            payload.append('name', formData.name);
            payload.append('description', formData.description || '');
            payload.append('price', String(formData.price));
            payload.append('isActive', String(formData.isActive));
            payload.append('items', JSON.stringify(formData.items.map(item => ({
                productId: item.productId,
                qty: item.qty
            }))));
            if (formData.imageFile) payload.append('image', formData.imageFile);

            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: payload
            });

            const result = await res.json();
            if (result.success) {
                showAlert.success("Berhasil", result.message);
                setIsModalOpen(false);
                fetchPackages();
            } else {
                showAlert.error("Gagal", result.message);
            }
        } catch (error) {
            showAlert.error("Error", "Gagal menyimpan data");
        }
    };

    const handleDelete = async (id) => {
        const confirm = await showAlert.confirm(
            "Hapus Paket?",
            "Data beserta item di dalamnya akan dihapus."
        );

        if (confirm) {
            try {
                const res = await fetch(`${API_URL}/api/packages/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await res.json();
                if (result.success) {
                    showAlert.success("Berhasil", "Paket dihapus");
                    fetchPackages();
                } else {
                    showAlert.error("Gagal", result.message);
                }
            } catch (error) {
                showAlert.error("Error", "Gagal menghapus data");
            }
        }
    };

    const handleToggleActive = async (pkg) => {
        try {
            const res = await fetch(`${API_URL}/api/packages/${pkg.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive: !pkg.isActive })
            });
            const result = await res.json();
            if (result.success) {
                fetchPackages();
            }
        } catch (error) {
            showAlert.error("Error", "Gagal mengubah status paket");
        }
    };

    const filteredPackages = packages.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getImageUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('//')) {
            return path.startsWith('//') ? `https:${path}` : path;
        }
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return `${API_URL}/${cleanPath}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manajemen Paket (Bundling)</h1>
                    <p className="text-gray-500 text-sm mt-1">Kelola paket langganan atau bundling produk</p>
                </div>
                <button
                    onClick={() => { setSelectedPackage(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-sm hover:shadow-md active:scale-95"
                >
                    <Plus size={20} />
                    <span>Tambah Paket</span>
                </button>
            </div>

            {/* Filter */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Cari berdasarkan nama paket..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 h-64 animate-pulse">
                            <div className="h-6 w-1/2 bg-gray-200 rounded-md mb-4"></div>
                            <div className="h-4 w-3/4 bg-gray-100 rounded-md mb-8"></div>
                            <div className="h-10 w-full bg-gray-100 rounded-md mb-4"></div>
                        </div>
                    ))}
                </div>
            ) : filteredPackages.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="w-20 h-20 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <PackageIcon className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Tidak ada paket</h3>
                    <p className="text-gray-500">Belum ada paket/bundling yang ditambahkan.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredPackages.map((pkg) => (
                        <div key={pkg.id} className="relative bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all group flex flex-col">
                            {!pkg.isActive && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-2xl z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 shadow-sm">
                                        Nonaktif
                                    </span>
                                </div>
                            )}

                            <div className="relative z-20 -mx-5 -mt-5 mb-4 h-40 overflow-hidden rounded-t-2xl bg-gray-100">
                                {pkg.imageUrl ? (
                                    <img src={getImageUrl(pkg.imageUrl)} alt={pkg.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-gray-300">
                                        <PackageIcon size={42} strokeWidth={1.5} />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-start mb-2 relative z-20">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 line-clamp-1">{pkg.name}</h3>
                                    <p className="text-sm font-semibold text-blue-600 mt-1">{formatCurrency(pkg.price)}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleToggleActive(pkg)}
                                        className={`p-1.5 rounded-lg transition-colors ${pkg.isActive ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'text-orange-500 bg-orange-50'}`}
                                        title={pkg.isActive ? "Nonaktifkan" : "Aktifkan"}
                                    >
                                        {pkg.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button
                                        onClick={() => { setSelectedPackage(pkg); setIsModalOpen(true); }}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(pkg.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10 mt-2 relative z-20">
                                {pkg.description || "Tidak ada deskripsi"}
                            </p>

                            {/* Item List */}
                            <div className="mt-auto bg-gray-50 rounded-xl p-3 border border-gray-100 relative z-20">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Isi Paket ({pkg.items.length})</p>
                                <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                    {pkg.items.map((item, index) => (
                                        <div key={index} className="flex justify-between text-sm py-1 border-b border-gray-100/50 last:border-0">
                                            <span className="text-gray-700 truncate pr-2">{item.product?.name || 'Produk dihapus'}</span>
                                            <span className="font-semibold text-gray-900 bg-white px-1.5 rounded border border-gray-200">x{item.qty}</span>
                                        </div>
                                    ))}
                                    {pkg.items.length === 0 && (
                                        <p className="text-sm text-gray-400 italic">Kosong</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <PackageModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={selectedPackage}
            />
        </div>
    );
}
