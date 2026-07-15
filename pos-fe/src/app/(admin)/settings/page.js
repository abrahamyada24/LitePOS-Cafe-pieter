"use client";

import { useState, useEffect } from 'react';
import { 
  Save, Store, CreditCard, ShieldCheck, UploadCloud, 
  Receipt, Printer, Smartphone, DollarSign, Loader2, Image as ImageIcon,
  Truck, Plus, X, Trash2, Gift, Layout, PackageSearch, QrCode
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { showAlert } from '../../../utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SettingsPage() {
  const { settings, fetchDataMaster } = useStore();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    storeName: '',
    phone: '',
    address: '',
    email: '',
    website: '',
    enableCash: true,
    enableQris: false,
    enableDebit: false,
    taxRate: 0,
    serviceCharge: 0,
    autoPrintReceipt: true,
    receiptFooter: '',
    logoFile: null,
    allowNegativeStock: false,
    showImages: true,
    theme: 'light',
    enablePreOrder: false,
    enableShift: true,
    enableDineTable: false,
    enableTableOrder: false
  });

  const [loyaltyForm, setLoyaltyForm] = useState({
    pointMultiplier: 1,
    multiplierAmount: 10000,
    pointValue: 100,
    minRedemptionPoints: 10,
    isActive: true
  });

  const [logoPreview, setLogoPreview] = useState('');

  // Take Away Options state
  const [takeawayOptions, setTakeawayOptions] = useState([]);
  const [newTakeawayOption, setNewTakeawayOption] = useState('');

  const [passForm, setPassForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchDataMaster(); 
    fetchLoyaltyConfig();
  }, []);

  const fetchLoyaltyConfig = async () => {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/settings/loyalty`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
            setLoyaltyForm(data.data);
        }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName || '',
        phone: settings.phone || '',
        address: settings.address || '',
        email: settings.email || '',
        website: settings.website || '',
        enableCash: settings.enableCash,
        enableQris: settings.enableQris,
        enableDebit: settings.enableDebit,
        taxRate: Number(settings.taxRate) || 0,
        serviceCharge: Number(settings.serviceCharge) || 0,
        autoPrintReceipt: settings.autoPrintReceipt,
        receiptFooter: settings.receiptFooter || '',
        logoFile: null,
        allowNegativeStock: settings.allowNegativeStock,
        showImages: settings.showImages,
        theme: settings.theme || 'light',
        enablePreOrder: settings.enablePreOrder || false,
        enableShift: settings.enableShift !== undefined ? settings.enableShift : true,
        enableDineTable: settings.enableDineTable || false,
        enableTableOrder: settings.enableTableOrder || false
      });
      if (settings.logoUrl) {
          setLogoPreview(settings.logoUrl.startsWith('http') ? settings.logoUrl : `${API_URL}${settings.logoUrl}`);
      }
      // Load takeaway options
      try {
          const parsed = settings.takeawayOptions ? JSON.parse(settings.takeawayOptions) : [];
          setTakeawayOptions(Array.isArray(parsed) ? parsed : []);
      } catch { setTakeawayOptions([]); }
    }
  }, [settings]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name) => {
    setForm(prev => {
      const next = { ...prev, [name]: !prev[name] };
      if (name === 'enableTableOrder' && !prev.enableTableOrder) next.enableDineTable = true;
      if (name === 'enableDineTable' && prev.enableDineTable) next.enableTableOrder = false;
      return next;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({ ...prev, logoFile: file }));
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
        const token = localStorage.getItem('token');
        const formData = new FormData();

        Object.keys(form).forEach(key => {
            if (key !== 'logoFile') {
                formData.append(key, form[key]);
            }
        });
        formData.append('takeawayOptions', JSON.stringify(takeawayOptions));

        if (form.logoFile) {
            formData.append('logo', form.logoFile);
        }

        const res = await fetch(`${API_URL}/api/settings`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!res.ok) throw new Error("Gagal menyimpan pengaturan");
        
        await fetchDataMaster(); 
        showAlert.success('Pengaturan tersimpan', 'Konfigurasi aplikasi berhasil diperbarui.');

    } catch (error) {
        showAlert.error('Gagal menyimpan pengaturan', error.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSaveLoyalty = async () => {
    setIsLoading(true);
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/settings/loyalty`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loyaltyForm)
        });

        if (!res.ok) throw new Error("Gagal menyimpan konfigurasi loyalitas");
        showAlert.success('Loyalitas tersimpan', 'Konfigurasi loyalitas berhasil diperbarui.');
    } catch (error) {
        showAlert.error('Gagal menyimpan loyalitas', error.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (passForm.newPassword !== passForm.confirmPassword) {
        return showAlert.warning('Konfirmasi tidak cocok', 'Password baru dan konfirmasi harus sama.');
    }
    
    setIsLoading(true);
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                oldPassword: passForm.oldPassword,
                newPassword: passForm.newPassword
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        showAlert.success('Password diubah', 'Silakan login ulang menggunakan password baru.');
        setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });

    } catch (error) {
        showAlert.error('Gagal mengubah password', error.message);
    } finally {
        setIsLoading(false);
    }
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
        activeTab === id 
          ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 border border-transparent'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Pengaturan</h2>
          <p className="text-gray-400 text-sm">Kelola profil toko, pembayaran, dan sistem.</p>
        </div>
        {activeTab !== 'security' && (
            <button 
                onClick={activeTab === 'loyalty' ? handleSaveLoyalty : handleSaveSettings}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow-lg shadow-blue-200 transition-colors font-medium disabled:opacity-70"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} 
                Simpan Perubahan
            </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-100 pb-2 overflow-x-auto no-scrollbar">
        <TabButton id="general" label="Profil Toko" icon={Store} />
        <TabButton id="payment" label="Pembayaran" icon={CreditCard} />
        <TabButton id="system" label="Sistem & Struk" icon={Receipt} />
        <TabButton id="takeaway" label="Layanan Take Away" icon={Truck} />
        <TabButton id="loyalty" label="Poin Pelanggan" icon={Gift} />
        <TabButton id="security" label="Keamanan" icon={ShieldCheck} />
      </div>

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-1">
            <div className="card-base p-6 text-center h-full">
                <h3 className="font-bold text-gray-800 mb-4">Logo Struk</h3>
                <div className="border-2 border-dashed border-gray-200 rounded-2xl h-48 flex flex-col items-center justify-center bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group relative overflow-hidden">
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer z-20"
                    />
                    {logoPreview ? (
                        <img src={logoPreview} alt="Logo Toko" className="w-full h-full object-contain p-2" />
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Store size={32} className="text-blue-500" />
                            </div>
                            <p className="text-xs text-gray-500 font-medium">Klik untuk upload logo</p>
                            <p className="text-[10px] text-gray-400 mt-1">Format: JPG, PNG (Max 2MB)</p>
                        </>
                    )}
                </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card-base p-6 space-y-5">
                <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3">Informasi Dasar</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
                        <input name="storeName" value={form.storeName} onChange={handleChange} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                        <input name="phone" value={form.phone} onChange={handleChange} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap</label>
                    <textarea name="address" value={form.address} onChange={handleChange} rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Toko</label>
                        <input name="email" value={form.email} onChange={handleChange} type="email" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website / Sosmed</label>
                        <input name="website" value={form.website} onChange={handleChange} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white" />
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card-base p-6">
                <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">Metode Pembayaran Aktif</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors bg-white">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 text-green-600 rounded-xl"><DollarSign size={24} /></div>
                            <div>
                                <p className="font-bold text-gray-800">Tunai (Cash)</p>
                                <p className="text-xs text-gray-500">Terima pembayaran uang fisik</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.enableCash} onChange={() => handleToggle('enableCash')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors bg-white">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Smartphone size={24} /></div>
                            <div>
                                <p className="font-bold text-gray-800">QRIS (Midtrans)</p>
                                <p className="text-xs text-gray-500">Scan barcode otomatis</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.enableQris} onChange={() => handleToggle('enableQris')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors bg-white">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><CreditCard size={24} /></div>
                            <div>
                                <p className="font-bold text-gray-800">EDC / Debit</p>
                                <p className="text-xs text-gray-500">Mesin EDC Bank (Manual Input)</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.enableDebit} onChange={() => handleToggle('enableDebit')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card-base p-6">
                <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">Konfigurasi Keuangan</h3>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Pajak (PPN)</p>
                            <p className="text-xs text-gray-500">Persentase pajak yang ditanggung pelanggan.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" name="taxRate" value={form.taxRate} onChange={handleChange} className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-right font-bold focus:border-blue-500 outline-none" />
                            <span className="text-sm font-bold text-gray-600">%</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Service Charge</p>
                            <p className="text-xs text-gray-500">Biaya layanan tambahan (opsional).</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" name="serviceCharge" value={form.serviceCharge} onChange={handleChange} className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-right font-bold focus:border-blue-500 outline-none" />
                            <span className="text-sm font-bold text-gray-600">%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-base p-6">
                <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3 flex items-center gap-2">
                    <Layout size={18} /> Pengaturan Tampilan & Inventori
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Izinkan Stok Negatif</p>
                            <p className="text-xs text-gray-500">Tetap bisa jualan meski stok habis/nol di sistem.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.allowNegativeStock} onChange={() => handleToggle('allowNegativeStock')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Tampilkan Gambar Produk</p>
                            <p className="text-xs text-gray-500">Munculkan foto produk di layar kasir (Android).</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.showImages} onChange={() => handleToggle('showImages')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 font-bold">Tema Aplikasi</label>
                        <select 
                            name="theme" 
                            value={form.theme} 
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm"
                        >
                            <option value="light">Terang (Light)</option>
                            <option value="dark">Gelap (Dark)</option>
                            <option value="system">Ikuti Sistem HP</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="card-base p-6 mt-6">
                <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3 flex items-center gap-2">
                    <Smartphone size={18} /> Fitur Android POS
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Fitur Kas Kasir / Shift</p>
                            <p className="text-xs text-gray-500">Mewajibkan buka/tutup kasir setiap hari.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.enableShift} onChange={() => handleToggle('enableShift')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Fitur Pre-Order</p>
                            <p className="text-xs text-gray-500">Izinkan input tanggal pengambilan di checkout.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.enablePreOrder} onChange={() => handleToggle('enablePreOrder')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Fitur Meja (Dine-In)</p>
                            <p className="text-xs text-gray-500">Manajemen nomor meja saat transaksi.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={form.enableDineTable} onChange={() => handleToggle('enableDineTable')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-start gap-3">
                            <QrCode size={18} className="text-emerald-600 mt-0.5" />
                            <div>
                                <p className="font-bold text-gray-800 text-sm">Order Meja via QR</p>
                                <p className="text-xs text-gray-500">Pembeli memesan dari QR meja dan order masuk ke kasir.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                            <input type="checkbox" className="sr-only peer" checked={form.enableTableOrder} onChange={() => handleToggle('enableTableOrder')} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'loyalty' && (
        <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card-base p-6 border-l-4 border-l-blue-500">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <Gift className="text-blue-500" size={20} /> Program Loyalitas Poin
                </h3>
                <p className="text-xs text-gray-500 mb-6">Berikan poin kepada pelanggan setiap kelipatan pembelian tertentu. Poin dapat ditukar menjadi potongan harga.</p>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">Status Program Poin</p>
                            <p className="text-xs text-gray-500">Aktifkan atau nonaktifkan fitur poin di kasir.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={loyaltyForm.isActive} 
                                onChange={() => setLoyaltyForm({...loyaltyForm, isActive: !loyaltyForm.isActive})} 
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700">Setiap Belanja Kelipatan</label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 font-bold">Rp</span>
                                <input 
                                    type="number" 
                                    value={loyaltyForm.multiplierAmount} 
                                    onChange={(e) => setLoyaltyForm({...loyaltyForm, multiplierAmount: e.target.value})}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700">Mendapatkan Poin</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={loyaltyForm.pointMultiplier} 
                                    onChange={(e) => setLoyaltyForm({...loyaltyForm, pointMultiplier: e.target.value})}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-center"
                                />
                                <span className="text-gray-400 font-bold">Poin</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700">Nilai 1 Poin (Penukaran)</label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 font-bold">Rp</span>
                                <input 
                                    type="number" 
                                    value={loyaltyForm.pointValue} 
                                    onChange={(e) => setLoyaltyForm({...loyaltyForm, pointValue: e.target.value})}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700">Min. Poin Untuk Tukar</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={loyaltyForm.minRedemptionPoints} 
                                    onChange={(e) => setLoyaltyForm({...loyaltyForm, minRedemptionPoints: e.target.value})}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-bold text-center"
                                />
                                <span className="text-gray-400 font-bold">Poin</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            <strong>Simulasi:</strong> Jika pelanggan belanja Rp 50.000, maka ia akan mendapatkan 
                            <span className="font-bold underline mx-1">
                                {Math.floor(50000 / (loyaltyForm.multiplierAmount || 10000)) * (loyaltyForm.pointMultiplier || 1)} Poin
                            </span>. 
                            10 Poin dapat ditukar dengan potongan belanja senilai 
                            <span className="font-bold underline ml-1">Rp {10 * (loyaltyForm.pointValue || 100)}</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'takeaway' && (
        <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card-base p-6">
                <h3 className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-3 flex items-center gap-2">
                    <Truck size={18} /> Layanan Beli Online (Take Away)
                </h3>
                <p className="text-xs text-gray-500 mb-4">Kelola daftar layanan online seperti GoFood, GrabFood, ShopeeFood, dll. Daftar ini akan muncul saat kasir memilih Take Away di POS.</p>

                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={newTakeawayOption} 
                        onChange={(e) => setNewTakeawayOption(e.target.value)} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTakeawayOption.trim()) {
                                if (!takeawayOptions.includes(newTakeawayOption.trim())) {
                                    setTakeawayOptions([...takeawayOptions, newTakeawayOption.trim()]);
                                }
                                setNewTakeawayOption('');
                            }
                        }}
                        placeholder="Nama layanan, misal: GoFood" 
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white text-sm" 
                    />
                    <button 
                        onClick={() => {
                            if (newTakeawayOption.trim() && !takeawayOptions.includes(newTakeawayOption.trim())) {
                                setTakeawayOptions([...takeawayOptions, newTakeawayOption.trim()]);
                                setNewTakeawayOption('');
                            }
                        }}
                        className="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium flex items-center gap-1 text-sm"
                    >
                        <Plus size={16} /> Tambah
                    </button>
                </div>

                {takeawayOptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <Truck size={40} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Belum ada layanan. Tambahkan di atas.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {takeawayOptions.map((opt, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white hover:border-orange-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center font-black text-xs">{idx + 1}</div>
                                    <span className="font-medium text-gray-800 text-sm">{opt}</span>
                                </div>
                                <button 
                                    onClick={() => setTakeawayOptions(takeawayOptions.filter((_, i) => i !== idx))}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <p className="text-[10px] text-gray-400 mt-4">*Klik "Simpan Perubahan" di atas untuk menyimpan daftar ini ke server.</p>
            </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card-base p-6 border border-red-100 bg-white">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-red-600 pb-4 border-b border-red-50">
                    <ShieldCheck size={20} /> Ganti Password Akun
                </h3>
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
                        <input 
                            type="password" 
                            value={passForm.oldPassword} 
                            onChange={(e) => setPassForm({...passForm, oldPassword: e.target.value})} 
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-300 transition-all bg-gray-50 focus:bg-white" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                        <input 
                            type="password" 
                            value={passForm.newPassword} 
                            onChange={(e) => setPassForm({...passForm, newPassword: e.target.value})}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-300 transition-all bg-gray-50 focus:bg-white" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                        <input 
                            type="password" 
                            value={passForm.confirmPassword} 
                            onChange={(e) => setPassForm({...passForm, confirmPassword: e.target.value})}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-300 transition-all bg-gray-50 focus:bg-white" 
                        />
                    </div>
                    <div className="pt-4">
                        <button 
                            onClick={handleUpdatePassword}
                            disabled={isLoading}
                            className="w-full px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="animate-spin"/> : <ShieldCheck size={18}/>}
                            Update Password
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
