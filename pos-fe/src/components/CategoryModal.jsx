"use client";

import { useState, useEffect } from 'react';
import { X, UploadCloud, Save, Edit3, Grid2X2, Maximize, AppWindow } from 'lucide-react';

export default function CategoryModal({ isOpen, onClose, onSave, initialData }) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const [name, setName] = useState('');
  const [size, setSize] = useState('normal');
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // --- HELPER UNTUK PREVIEW GAMBAR ---
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
      if (initialData) {
        setName(initialData.name);
        setSize(initialData.displayType || 'normal');
        setPreviewUrl(getImageUrl(initialData.imageUrl));
      } else {
        setName('');
        setSize('normal');
        setImageFile(null);
        setPreviewUrl('');
      }
    }
  }, [isOpen, initialData]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, size, imageFile });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] shadow-2xl overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-300">

        <div className="px-4 py-4 sm:px-8 sm:py-6 flex justify-between items-center bg-gray-950 text-white relative shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-2.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20 shrink-0">
              <Grid2X2 size={21} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-lg sm:text-2xl tracking-tight leading-tight truncate">
                {initialData ? 'Edit Kategori' : 'Tambah Kategori'}
              </h3>
              <p className="text-gray-400 text-xs font-medium mt-0.5">Nama, gambar, dan ukuran tampilan</p>
            </div>
          </div>
          <button type="button" aria-label="Tutup" title="Tutup" onClick={onClose} className="w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white shrink-0">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">

            {/* Foto Section */}
            <div className="md:col-span-5 space-y-3">
              <label className="text-xs font-bold text-gray-600 block">Gambar kategori</label>
              <div className="aspect-[16/9] md:aspect-square rounded-lg bg-gray-50 border-2 border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group hover:border-blue-500/40 transition-all cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                />
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="flex flex-col items-center gap-3 group-hover:text-blue-500 transition-colors">
                    <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                      <UploadCloud size={32} strokeWidth={1.5} />
                    </div>
                    <span className="text-xs font-bold">Pilih gambar</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <Edit3 className="text-white" size={32} />
                </div>
              </div>
            </div>

            {/* Input Section */}
            <div className="md:col-span-7 space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-2">Nama kategori</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-lg text-gray-900 font-bold text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                  placeholder="Contoh: Makanan"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-3">Ukuran kartu katalog</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'normal', label: 'Normal', size: '1x1', icon: AppWindow },
                    { id: 'wide', label: 'Lebar', size: '2x1', icon: Maximize },
                    { id: 'tall', label: 'Tinggi', size: '1x2', icon: Maximize },
                    { id: 'large', label: 'Besar', size: '2x2', icon: Grid2X2 },
                  ].map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSize(opt.id)}
                        className={`min-h-16 p-3 rounded-lg border-2 text-left transition-all relative group ${size === opt.id
                            ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-md ring-8 ring-blue-500/5'
                            : 'border-gray-100 text-gray-400 hover:border-gray-200 bg-white'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-black text-xs uppercase tracking-tighter">{opt.label}</p>
                          <Icon size={14} className={size === opt.id ? 'text-blue-500' : 'text-gray-300'} />
                        </div>
                        <p className="text-[10px] font-bold opacity-60">{opt.size} Grid Units</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-4 sm:-mx-8 -mb-4 sm:-mb-8 px-4 sm:px-8 py-4 bg-white border-t border-gray-200 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 sm:flex-none px-5 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-sm rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-11 flex-[2] sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all active:scale-95 font-bold text-sm flex items-center justify-center gap-2"
            >
              <Save size={18} strokeWidth={3} />
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
