"use client";

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, ImageIcon, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
// Menggunakan relative paths untuk menghindari kendala resolusi alias @/ di beberapa environment
import { useStore } from '../../../store/useStore';
import ProductModal from '../../../components/ProductModal';
import { showAlert } from '../../../utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ProductsPage() {
    const { products, categories, fetchDataMaster } = useStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    useEffect(() => {
        fetchDataMaster();
    }, []);

    const getImageUrl = (path) => {
        if (!path) return null;

        if (path.startsWith('http') || path.startsWith('//')) {
            return path.startsWith('//') ? `https:${path}` : path;
        }

        return `${API_URL}${path}`;
    };

    const formatRp = (num) => "Rp " + (Number(num) || 0).toLocaleString('id-ID');

    const getStockStatus = (item) => {
        if (item.isUnlimitedStock) return { label: 'Tak Terbatas', color: 'bg-indigo-500 text-white' };
        if (item.stock === 0) return { label: 'Habis', color: 'bg-red-500 text-white' };
        if (item.stock < 5) return { label: 'Menipis', color: 'bg-blue-500 text-white' };
        return { label: `Stok: ${item.stock}`, color: 'bg-white/20 backdrop-blur-md text-white border border-white/20' };
    }

    const getSpanClass = (size) => {
        switch (size) {
            case 'large': return 'md:col-span-2 md:row-span-2';
            case 'tall': return 'md:col-span-1 md:row-span-2';
            case 'wide': return 'md:col-span-2 md:row-span-1';
            default: return 'md:col-span-1 md:row-span-1';
        }
    }

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            // Sembunyikan produk yang sudah di-soft delete
            if (product.isActive === false) return false;

            const name = product.name || '';
            const sku = product.sku || '';
            const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sku.toLowerCase().includes(searchQuery.toLowerCase());

            const categoryName = product.category ? product.category.name : 'Uncategorized';
            const matchesCategory = selectedCategory === 'Semua' || categoryName === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, selectedCategory]);

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    const handleAdd = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleEdit = (product, e) => {
        e.stopPropagation();
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        const confirmed = await showAlert.confirm("Hapus Produk?", "Produk akan dinonaktifkan dan disembunyikan dari daftar.");

        if (confirmed) {
            try {
                showAlert.loading("Menghapus data...");
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/products/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    showAlert.success("Terhapus", "Produk berhasil dihapus.");
                    fetchDataMaster();
                } else {
                    showAlert.error("Gagal", "Produk tidak bisa dihapus.");
                }
            } catch (error) {
                showAlert.error("Error", "Koneksi ke server gagal.");
            }
        }
    };

    const handleSaveProduct = async (formData) => {
        const token = localStorage.getItem('token');
        const data = new FormData();
        data.append('name', formData.name);
        data.append('sku', formData.sku || '');
        data.append('barcode', formData.barcode || '');
        data.append('price', formData.price);
        data.append('costPrice', formData.costPrice);
        data.append('stock', formData.isUnlimitedStock ? 999 : (formData.stock === '' ? 0 : formData.stock));
        data.append('minStock', formData.minStock === '' ? 0 : formData.minStock);
        data.append('categoryId', formData.categoryId);
        data.append('isActive', formData.status === 'active');
        data.append('isUnlimitedStock', formData.isUnlimitedStock === true);
        data.append('displayType', formData.displayType);
        data.append('discountActive', formData.discountActive === true);
        data.append('discountType', formData.discountType || 'PERCENT');
        data.append('discountValue', formData.discountValue || 0);
        data.append('discountStartAt', formData.discountStartAt || '');
        data.append('discountEndAt', formData.discountEndAt || '');
        data.append('discountStartTime', formData.discountStartTime || '');
        data.append('discountEndTime', formData.discountEndTime || '');
        data.append('discountDays', Array.isArray(formData.discountDays) ? formData.discountDays.join(',') : '');
        data.append('discountLabel', formData.discountLabel || '');

        if (formData.imageFile) {
            data.append('image', formData.imageFile);
        }

        try {
            showAlert.loading("Sedang menyimpan...");
            const url = editingProduct ? `${API_URL}/api/products/${editingProduct.id}` : `${API_URL}/api/products`;
            const method = editingProduct ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` },
                body: data
            });

            const result = await res.json();

            if (res.ok && result.success) {
                // TUTUP MODAL OTOMATIS
                setIsModalOpen(false);
                // REFRESH DATA DARI SERVER
                await fetchDataMaster();
                showAlert.success("Berhasil!", editingProduct ? "Menu diperbarui." : "Menu baru ditambahkan.");
            } else {
                showAlert.error("Gagal", result.message || result.error || "Cek kembali data input.");
            }
        } catch (error) {
            showAlert.error("Error Jaringan", "Gagal menghubungi backend.");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex flex-1 gap-2 max-w-2xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Cari menu / SKU..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 shadow-sm transition-all"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={selectedCategory}
                            onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                            className="h-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8 shadow-sm"
                        >
                            <option value="Semua">Semua</option>
                            {categories.map((cat) => (
                                cat.id !== 0 && <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                    </div>
                </div>
                <button onClick={handleAdd} className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-95">
                    <Plus size={18} /> Tambah Menu
                </button>
            </div>

            {/* Bento Grid Produk */}
            <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[200px] gap-4">
                {/* Tombol Cepat Tambah Produk */}
                {currentPage === 1 && !searchQuery && selectedCategory === 'Semua' && (
                    <div onClick={handleAdd} className="md:col-span-1 md:row-span-1 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer bg-gray-50/50 group">
                        <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform"><Plus size={24} /></div>
                        <span className="font-medium text-sm">Tambah Menu Baru</span>
                    </div>
                )}

                {/* List Produk */}
                {currentProducts.map((item) => (
                    <div
                        key={item.id}
                        className={`group relative rounded-3xl overflow-hidden border border-gray-100 bg-white hover:shadow-xl transition-all duration-300 cursor-pointer ${getSpanClass(item.displayType || 'normal')}`}
                        onClick={() => handleEdit(item, { stopPropagation: () => { } })}
                    >
                        <div className="absolute inset-0">
                            {item.imageUrl ? (
                                <img src={getImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            ) : (
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300"><ImageIcon size={48} /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        </div>

                        {/* Status Label (Top Left) */}
                        <div className="absolute top-3 left-3 flex gap-2">
                            <span className="px-2 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold rounded-lg border border-white/20 uppercase tracking-wider">
                                {item.category ? item.category.name : 'Umum'}
                            </span>
                            {item.isDiscountActive && (
                                <span className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg uppercase">
                                    {item.discountLabel || 'Promo'}
                                </span>
                            )}
                        </div>

                        {/* Hover Actions (Top Right) */}
                        <div className="absolute top-3 right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={(e) => handleEdit(item, e)} className="p-2 bg-white/90 rounded-full text-gray-700 hover:text-blue-500 shadow-sm"><Edit size={14} /></button>
                            <button onClick={(e) => handleDelete(item.id, e)} className="p-2 bg-white/90 rounded-full text-gray-700 hover:text-red-500 shadow-sm"><Trash2 size={14} /></button>
                        </div>

                        {/* Bottom Info */}
                        <div className="absolute bottom-0 p-5 text-white w-full">
                            <h3 className="font-bold text-lg leading-tight truncate">{item.name}</h3>
                            <p className="text-gray-300 text-[10px] font-mono mb-2 opacity-80 uppercase">{item.sku}</p>
                            {item.isDiscountActive && <p className="text-gray-300 line-through text-xs">{formatRp(item.originalPrice || item.price)}</p>}
                            <p className={`${item.isDiscountActive ? 'text-red-300' : 'text-blue-400'} font-black text-xl`}>{formatRp(item.effectivePrice ?? item.price)}</p>
                            <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold shadow-sm whitespace-nowrap ${getStockStatus(item).color}`}>
                                {getStockStatus(item).label}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 pt-6 border-t border-gray-100">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 border rounded-xl border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronLeft size={20} /></button>
                    <span className="text-sm font-medium text-gray-600">Halaman <span className="text-blue-500 font-bold">{currentPage}</span> dari {totalPages}</span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 border rounded-xl border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronRight size={20} /></button>
                </div>
            )}

            {/* Modal CRUD */}
            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProduct}
                initialData={editingProduct}
                categories={categories}
            />
        </div>
    );
}
