/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, UploadCloud } from 'lucide-react';
import { useStore } from '@/store/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PackageModal({ isOpen, onClose, onSave, initialData }) {
    const { token } = useStore();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        isActive: true,
        imageFile: null,
        items: [] // { productId, qty, product: { name, price } }
    });
    const [previewUrl, setPreviewUrl] = useState('');
    const [products, setProducts] = useState([]);
    const [searchProduct, setSearchProduct] = useState('');
    const [isSearchingProduct, setIsSearchingProduct] = useState(false);

    const getImageUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('//')) {
            return path.startsWith('//') ? `https:${path}` : path;
        }
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return `${API_URL}/${cleanPath}`;
    };

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            if (initialData) {
                setFormData({
                    name: initialData.name || '',
                    description: initialData.description || '',
                    price: initialData.price || '',
                    isActive: initialData.isActive !== false,
                    imageFile: null,
                    items: initialData.items ? [...initialData.items] : []
                });
                setPreviewUrl(getImageUrl(initialData.imageUrl));
            } else {
                setFormData({
                    name: '',
                    description: '',
                    price: '',
                    isActive: true,
                    imageFile: null,
                    items: []
                });
                setPreviewUrl('');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialData]);

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API_URL}/api/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.success) {
                setProducts(result.data.filter(p => p.isActive)); // Hanya ambil produk aktif
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFormData(current => ({ ...current, imageFile: file }));
        setPreviewUrl(URL.createObjectURL(file));
    };

    const addItem = (product) => {
        const exists = formData.items.find(i => i.productId === product.id);
        if (exists) {
            setFormData({
                ...formData,
                items: formData.items.map(i => i.productId === product.id ? { ...i, qty: Number(i.qty) + 1 } : i)
            });
        } else {
            setFormData({
                ...formData,
                items: [...formData.items, { productId: product.id, qty: 1, product }]
            });
        }
        setSearchProduct('');
        setIsSearchingProduct(false);
    };

    const updateItemQty = (productId, qty) => {
        if (qty < 1) return;
        setFormData({
            ...formData,
            items: formData.items.map(i => i.productId === productId ? { ...i, qty: Number(qty) } : i)
        });
    };

    const removeItem = (productId) => {
        setFormData({
            ...formData,
            items: formData.items.filter(i => i.productId !== productId)
        });
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchProduct.toLowerCase()) &&
        !formData.items.find(i => i.productId === p.id) // Jangan tampilkan yang sudah ada
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {initialData ? 'Edit Paket' : 'Tambah Paket Baru'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">Gabungkan beberapa produk menjadi satu harga</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 custom-scrollbar">
                    <form id="packageForm" onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gambar Paket</label>
                            <div className="relative h-44 overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-blue-400">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                                    aria-label="Pilih gambar paket"
                                />
                                {previewUrl ? (
                                    <>
                                        <img src={previewUrl} alt="Preview gambar paket" className="h-full w-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                                            <span className="rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-gray-700">Ganti gambar</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                                        <UploadCloud size={36} strokeWidth={1.5} />
                                        <span className="text-sm font-semibold">Klik untuk upload gambar</span>
                                        <span className="text-xs">JPG, PNG, atau WEBP (maks. 2 MB)</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nama Paket *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    placeholder="Contoh: Paket Hemat Berdua"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Harga Jual Paket (Rp) *</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-mono"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Deskripsi</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                placeholder="Contoh: Terdiri dari 2 Ayam + 2 Nasi + 2 Es Teh"
                                rows={2}
                            />
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-4 relative">
                                <label className="block text-sm font-bold text-gray-800">Daftar Isi Paket (Produk)</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSearchingProduct(!isSearchingProduct)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                                    >
                                        <Plus size={16} /> Tambah Isi
                                    </button>

                                    {/* Dropdown Pencarian Produk */}
                                    {isSearchingProduct && (
                                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                                            <div className="p-2 border-b border-gray-100">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Cari produk..."
                                                        value={searchProduct}
                                                        onChange={(e) => setSearchProduct(e.target.value)}
                                                        className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                {filteredProducts.length > 0 ? (
                                                    filteredProducts.slice(0, 10).map(p => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => addItem(p)}
                                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex justify-between items-center"
                                                        >
                                                            <span className="text-sm font-medium text-gray-700 truncate">{p.name}</span>
                                                            <span className="text-xs text-gray-400">{p.price}</span>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <p className="p-4 text-center text-sm text-gray-500">Tidak ada produk ditemukan{searchProduct ? '' : ' (Atau semua produk sudah ditambahkan)'}.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* List Item yang dipilih */}
                            <div className="space-y-3">
                                {formData.items.length === 0 ? (
                                    <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                        <p className="text-sm text-gray-500 font-medium">Belum ada produk isi paket.</p>
                                        <p className="text-xs text-gray-400 mt-1">Klik "Tambah Isi" untuk memilih produk dari inventory yang akan dimasukkan ke dalam paket ini.</p>
                                    </div>
                                ) : (
                                    formData.items.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white shadow-sm">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="text-sm font-bold text-gray-800 truncate">{item.product?.name || 'Produk'}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">@ Rp {item.product?.price || 0}</p>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                                                    <button type="button" className="px-2 py-1 text-gray-600 hover:bg-gray-200" onClick={() => updateItemQty(item.productId, item.qty - 1)}>-</button>
                                                    <input 
                                                        type="number" 
                                                        className="w-12 text-center text-sm font-bold bg-white border-x border-gray-300 py-1 outline-none" 
                                                        value={item.qty} 
                                                        onChange={(e) => updateItemQty(item.productId, e.target.value)}
                                                        min="1"
                                                    />
                                                    <button type="button" className="px-2 py-1 text-gray-600 hover:bg-gray-200" onClick={() => updateItemQty(item.productId, item.qty + 1)}>+</button>
                                                </div>

                                                <button 
                                                    type="button" 
                                                    onClick={() => removeItem(item.productId)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                <span className="font-bold text-lg">ℹ</span>
                            </div>
                            <p className="text-xs text-blue-800 leading-relaxed">
                                <strong>Tips Penjualan:</strong> Harga paket bisa Anda atur lebih murah dari total harga normal produk yang ada di dalamnya agar pelanggan lebih tertarik membeli.
                            </p>
                        </div>
                        
                        {/* Jarak agar dropdown menu atas tidak mentok batas div parent yang overflow */}
                        <div className="h-20"></div>
                    </form>
                </div>

                <div className="p-5 border-t border-gray-100 flex gap-3 bg-gray-50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 font-semibold rounded-xl transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        form="packageForm"
                        disabled={formData.items.length === 0}
                        className="flex-1 px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Simpan Paket
                    </button>
                </div>
            </div>
        </div>
    );
}
