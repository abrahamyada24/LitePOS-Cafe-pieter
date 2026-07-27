"use client";

import { useState, useEffect } from 'react';
import { X, UploadCloud, Save, Mail, Lock, AtSign } from 'lucide-react';

export default function UserModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    currentPassword: '',
    role: 'CASHIER',
    isActive: true,
    imageFile: null
  });
  const [previewUrl, setPreviewUrl] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Mode Edit
        setFormData({
          name: initialData.name,
          email: initialData.email,
          username: initialData.username || '',
          password: '',
          currentPassword: '',
          role: initialData.role,
          isActive: initialData.isActive,
          imageFile: null
        });
        setPreviewUrl(initialData.imageUrl ? `${API_URL}${initialData.imageUrl}` : '');
      } else {
        setFormData({
          name: '',
          email: '',
          username: '',
          password: '',
          currentPassword: '',
          role: 'CASHIER',
          isActive: true,
          imageFile: null
        });
        setPreviewUrl('');
      }
    }
  }, [isOpen, initialData]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, imageFile: file });
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const ownerIdentityChanged = Boolean(initialData?.role === 'OWNER' && (
    formData.email.trim().toLowerCase() !== String(initialData.email || '').trim().toLowerCase() ||
    formData.username.trim().toLowerCase() !== String(initialData.username || '').trim().toLowerCase()
  ));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h3 className="font-bold text-lg text-gray-800">
            {initialData ? 'Edit Data Pegawai' : 'Tambah Pegawai Baru'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-6 overflow-y-auto">
            <div className="flex flex-col md:flex-row gap-6">

              <div className="w-full md:w-1/3 space-y-3">
                <label className="block text-sm font-medium text-gray-700">Foto Profil</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl h-40 flex flex-col items-center justify-center text-gray-400 bg-gray-50 overflow-hidden relative cursor-pointer hover:border-blue-400 transition-colors group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  />
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 group-hover:text-blue-500">
                      <UploadCloud size={24} />
                      <span className="text-[10px]">Upload Foto</span>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <label className="text-xs font-bold text-gray-500 block mb-2">Status Akun</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: true })}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${formData.isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'text-gray-400 hover:bg-gray-200'}`}
                    >
                      Aktif
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: false })}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all ${!formData.isActive ? 'bg-red-100 text-red-700 border border-red-200' : 'text-gray-400 hover:bg-gray-200'}`}
                    >
                      Non-Aktif
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Nama Pegawai"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="email@toko.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      required
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                      pattern="[a-z0-9][a-z0-9._-]{2,49}"
                      title="3-50 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung"
                      autoCapitalize="none"
                      autoComplete="username"
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder="contoh: boss.toko"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Bisa dipakai untuk login di website dan Android.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role / Jabatan</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="CASHIER">Staff (Kasir)</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OWNER">Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password {initialData && <span className="text-gray-400 text-xs font-normal">(Opsional)</span>}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder={initialData ? "Biarkan kosong" : "Password..."}
                        required={!initialData}
                      />
                    </div>
                  </div>
                </div>

                {ownerIdentityChanged && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <label className="block text-sm font-medium text-amber-900 mb-1">Password Owner saat ini</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                      <input
                        required
                        type="password"
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
                        placeholder="Konfirmasi tanpa OTP"
                        autoComplete="current-password"
                      />
                    </div>
                    <p className="mt-1 text-xs text-amber-700">Setelah email atau username berubah, semua perangkat perlu login ulang.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow-lg shadow-blue-200 font-medium flex items-center gap-2 transition-colors"
            >
              <Save size={18} />
              Simpan Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
