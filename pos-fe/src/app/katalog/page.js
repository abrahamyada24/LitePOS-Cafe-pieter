"use client"
import React, { useState, useEffect } from 'react';
import { Search, Grid, List, AlignJustify, MessageCircle, AlertCircle, ShoppingBag, X } from 'lucide-react';
import Image from 'next/image';

export default function KatalogPage() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [settings, setSettings] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'compact'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCatalog();
    }, []);

    const fetchCatalog = async () => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${API_URL}/api/catalog`);
            const json = await res.json();
            if (json.success) {
                setProducts(json.data.products);
                setCategories(json.data.categories);
                setSettings(json.data.settings);
            }
        } catch (error) {
            console.error("Gagal mengambil data katalog", error);
        } finally {
            setLoading(false);
        }
    };

    const formatRupiah = (number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(number);
    };

    const openWhatsApp = (product) => {
        let phone = settings?.storePhone || '';
        if (!phone) {
            alert('Nomor WhatsApp toko belum diatur.');
            return;
        }
        
        if (phone.startsWith('0')) {
            phone = '62' + phone.slice(1);
        }
        phone = phone.replace(/\D/g, ''); // Hanya ambil angka
        
        const message = `Halo, saya ingin bertanya tentang produk *${product.name}* (Harga: ${formatRupiah(product.price)}). Apakah masih tersedia?`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const toggleViewMode = () => {
        if (viewMode === 'grid') setViewMode('list');
        else if (viewMode === 'list') setViewMode('compact');
        else setViewMode('grid');
    };

    const filteredProducts = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCat = selectedCategory === 'All' || p.categoryId === selectedCategory;
        return matchSearch && matchCat;
    });

    const getAPIUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header / Topbar */}
            <div className="bg-white sticky top-0 z-50 shadow-sm px-4 py-3 flex items-center gap-3">
                {isSearching ? (
                    <div className="flex-1 flex items-center bg-gray-100 rounded-lg px-3 py-2">
                        <Search size={18} className="text-gray-400" />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Cari produk..."
                            className="bg-transparent border-none outline-none flex-1 ml-2 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button onClick={() => { setIsSearching(false); setSearchQuery(''); }}>
                            <X size={18} className="text-gray-500" />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 relative">
                            <select
                                className="w-full bg-gray-100 text-gray-700 text-sm rounded-lg px-3 py-2.5 appearance-none outline-none font-medium"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="All">Semua Kategori</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>

                        <button onClick={() => setIsSearching(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                            <Search size={22} />
                        </button>
                        
                        <button onClick={toggleViewMode} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                            {viewMode === 'grid' && <Grid size={22} />}
                            {viewMode === 'list' && <List size={22} />}
                            {viewMode === 'compact' && <AlignJustify size={22} />}
                        </button>
                    </>
                )}
            </div>

            {/* Product List */}
            <div className={`p-4 ${viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex flex-col space-y-4'}`}>
                {filteredProducts.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center text-gray-400">
                        <ShoppingBag size={48} className="mb-4 opacity-50" />
                        <p>Tidak ada produk ditemukan</p>
                    </div>
                ) : (
                    filteredProducts.map(product => {
                        const lowStock = product.stock <= 5;
                        const imageUrl = product.image ? `${getAPIUrl()}${product.image}` : null;

                        if (viewMode === 'grid') {
                            return (
                                <div key={product.id} onClick={() => openWhatsApp(product)} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 relative cursor-pointer hover:shadow-md transition">
                                    <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-gray-300">
                                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            </div>
                                        )}
                                        {lowStock && (
                                            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold text-red-500 shadow-sm">
                                                &lt; 5 Stok
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h3 className="text-sm text-gray-800 line-clamp-1">{product.name}</h3>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="font-bold text-gray-900 text-sm">{formatRupiah(product.price)}<span className="text-xs text-gray-400 font-normal">/Pcs</span></p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (viewMode === 'list') {
                            return (
                                <div key={product.id} onClick={() => openWhatsApp(product)} className="bg-white rounded-xl p-3 flex gap-4 items-center shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
                                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-gray-300">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-gray-800 font-medium">{product.name}</h3>
                                        <p className="font-bold text-gray-900 mt-1">{formatRupiah(product.price)}<span className="text-xs text-gray-400 font-normal"> /Pcs</span></p>
                                        {lowStock && <p className="text-xs text-red-500 mt-1 font-medium">&lt; 5 Stok</p>}
                                    </div>
                                    <button className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                                        <MessageCircle size={20} />
                                    </button>
                                </div>
                            );
                        }

                        // Compact view
                        return (
                            <div key={product.id} onClick={() => openWhatsApp(product)} className="bg-white px-4 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-gray-800 font-medium">{product.name}</h3>
                                    <p className="font-bold text-gray-900 mt-1">{formatRupiah(product.price)}<span className="text-xs text-gray-400 font-normal"> /Pcs</span></p>
                                    {lowStock && <p className="text-xs text-red-500 mt-1 font-medium">&lt; 5 Stok</p>}
                                </div>
                                <button className="w-8 h-8 text-green-500">
                                    <MessageCircle size={22} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Global Floating WA Button (Optional, for general inquiry) */}
            <button 
                onClick={() => {
                    let phone = settings?.storePhone || '';
                    if (!phone) return;
                    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                    phone = phone.replace(/\D/g, '');
                    window.open(`https://wa.me/${phone}?text=Halo,%20saya%20ingin%20bertanya%20tentang%20katalog%20toko%20Anda.`, '_blank');
                }}
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-50"
            >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </button>
        </div>
    );
}
