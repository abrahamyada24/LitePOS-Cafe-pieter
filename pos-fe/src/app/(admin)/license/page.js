"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, Boxes, CalendarDays, CheckCircle2, Clock3, Copy, KeyRound, Loader2, MonitorSmartphone, ReceiptText, ShieldAlert, Trash2, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
  : 'Tanpa batas waktu';

const RESET_OPTIONS = {
  STOCK: {
    label: 'Reset Stok',
    phrase: 'RESET STOK',
    description: 'Nolkan stok seluruh produk serta hapus riwayat penerimaan dan pergerakan stok. Katalog dan transaksi tetap ada.',
    confirmText: 'Ya, Reset Stok',
    successTitle: 'Stok berhasil direset',
    successMessage: 'Stok seluruh produk menjadi 0. Katalog, transaksi, akun, lisensi, dan pengaturan tetap tersimpan.',
    icon: Boxes,
  },
  TRANSACTIONS: {
    label: 'Reset Transaksi',
    phrase: 'RESET TRANSAKSI',
    description: 'Hapus transaksi, pembayaran, pesanan tersimpan, dan antrean dapur. Stok, katalog, shift, serta pengeluaran tetap ada.',
    confirmText: 'Ya, Reset Transaksi',
    successTitle: 'Transaksi berhasil direset',
    successMessage: 'Seluruh transaksi telah dihapus. Stok, katalog, shift, pengeluaran, akun, lisensi, dan pengaturan tetap tersimpan.',
    icon: ReceiptText,
  },
  ALL: {
    label: 'Reset Semua',
    phrase: 'RESET OUTLET',
    description: 'Hapus seluruh data operasional termasuk transaksi, stok, katalog, pelanggan, supplier, paket, meja, shift, dan pengeluaran.',
    confirmText: 'Ya, Reset Semua',
    successTitle: 'Data berhasil dibersihkan',
    successMessage: 'Seluruh data operasional telah dihapus. Akun, lisensi, dan pengaturan toko tetap tersimpan.',
    icon: Trash2,
  },
};

export default function LicensePage() {
  const user = useStore((state) => state.user);
  const license = useStore((state) => state.license);
  const fetchLicenseStatus = useStore((state) => state.fetchLicenseStatus);
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetType, setResetType] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);
  const isOwner = user?.role === 'OWNER';
  const selectedReset = resetType ? RESET_OPTIONS[resetType] : null;

  const refresh = async () => {
    setLoading(true);
    await fetchLicenseStatus();
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const activate = async () => {
    if (!activationCode.trim()) return showAlert.warning('Kode belum diisi', 'Masukkan kode aktivasi dari pengelola LitePOS.');
    setActivating(true);
    try {
      const response = await fetch(`${baseUrl}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: activationCode }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Aktivasi gagal.');
      setActivationCode('');
      await fetchLicenseStatus();
      showAlert.success('Lisensi aktif', 'Masa aktif outlet berhasil diperpanjang untuk website dan Android.');
    } catch (error) {
      showAlert.error('Aktivasi gagal', error.message);
    } finally {
      setActivating(false);
    }
  };

  const closeResetDialog = () => {
    if (resetting) return;
    setShowResetDialog(false);
    setResetType(null);
    setResetPassword('');
    setResetPhrase('');
  };

  const resetData = async () => {
    if (!selectedReset) {
      return showAlert.warning('Jenis reset belum dipilih', 'Pilih reset stok, transaksi, atau semua data.');
    }
    if (!resetPassword || resetPhrase.trim() !== selectedReset.phrase) {
      return showAlert.warning('Konfirmasi belum lengkap', `Masukkan password Owner dan ketik ${selectedReset.phrase} dengan tepat.`);
    }

    const confirmed = await showAlert.confirmDanger(
      'Konfirmasi terakhir',
      `${selectedReset.description} Perubahan berlaku permanen di website dan seluruh Android.`,
      selectedReset.confirmText
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      const response = await fetch(`${baseUrl}/api/license/reset-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password: resetPassword,
          confirmation: resetPhrase.trim(),
          resetType,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Reset data gagal.');

      setShowResetDialog(false);
      setResetType(null);
      setResetPassword('');
      setResetPhrase('');
      showAlert.success(
        selectedReset.successTitle,
        selectedReset.successMessage
      );
    } catch (error) {
      showAlert.error('Reset data gagal', error.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading && !license) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin text-blue-500" size={42} /></div>;
  }

  const active = Boolean(license?.isActive);
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Lisensi Outlet</h1>
        <p className="text-sm text-gray-500 mt-1">Satu lisensi untuk website dan seluruh Android yang login ke outlet ini.</p>
      </div>

      <div className={`rounded-3xl border p-6 ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl grid place-items-center ${active ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
              {active ? <BadgeCheck size={30} /> : <ShieldAlert size={30} />}
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-widest ${active ? 'text-emerald-700' : 'text-red-700'}`}>{license?.status || 'TIDAK TERSEDIA'}</p>
              <h2 className="text-2xl font-black text-gray-900 mt-1">Paket {license?.plan || '-'}</h2>
              <p className="text-sm text-gray-600 mt-1">{active ? 'Operasional outlet dapat digunakan.' : 'Operasional terkunci sampai lisensi diperpanjang.'}</p>
            </div>
          </div>
          <div className="md:text-right">
            <p className="text-xs text-gray-500 font-bold">Sisa masa aktif</p>
            <p className="text-3xl font-black text-gray-900">{license?.daysRemaining ?? '∞'} <span className="text-sm font-bold text-gray-500">hari</span></p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-base p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2"><KeyRound size={17} /><span className="text-xs font-bold">Nomor Lisensi Outlet</span></div>
          <div className="flex items-center gap-3">
            <code className="text-lg font-black text-gray-900 flex-1">{license?.licenseNumber || '-'}</code>
            <button onClick={() => navigator.clipboard.writeText(license?.licenseNumber || '')} className="p-2 rounded-xl bg-gray-100 text-gray-600"><Copy size={17} /></button>
          </div>
        </div>
        <div className="card-base p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2"><CalendarDays size={17} /><span className="text-xs font-bold">Berlaku Sampai</span></div>
          <p className="font-black text-gray-900">{formatDate(license?.expiresAt)}</p>
        </div>
      </div>

      <div className="card-base p-6">
        <div className="flex items-start gap-3 mb-5">
          <MonitorSmartphone className="text-blue-600 mt-0.5" size={22} />
          <div>
            <h3 className="font-black text-gray-900">Tidak terikat perangkat</h3>
            <p className="text-sm text-gray-500 mt-1">Ganti HP tidak memerlukan lisensi baru. Perangkat cukup login ke akun outlet, sementara setiap sesi tetap dapat dicabut dari sistem keamanan.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
          <Clock3 size={15} /> Android dapat memakai cache lisensi maksimal {license?.offlineGraceDays || 7} hari saat server tidak terjangkau.
        </div>
      </div>

      <div className="card-base p-6">
        <h3 className="font-black text-gray-900 flex items-center gap-2"><KeyRound className="text-amber-500" size={20} /> Aktivasi / Perpanjang</h3>
        {isOwner ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              value={activationCode}
              onChange={(event) => setActivationCode(event.target.value.toUpperCase())}
              placeholder="LP-XXXX-XXXX-XXXX-XXXX-XXXX"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-mono font-bold tracking-wider focus:outline-none focus:border-blue-500"
            />
            <button onClick={activate} disabled={activating} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              {activating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Aktifkan
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-3">Hanya akun Owner yang dapat memasukkan kode aktivasi. Hubungi Owner outlet.</p>
        )}
      </div>

      {isOwner && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 grid place-items-center shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-black text-gray-900">Reset Data Outlet</h3>
                <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                  Pilih data yang ingin dibersihkan: hanya stok, hanya transaksi, atau seluruh data operasional. Akun, lisensi, sesi login, dan pengaturan toko tidak ikut dihapus.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowResetDialog(true)}
              className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2 shrink-0"
            >
              <Trash2 size={18} /> Pilih Data
            </button>
          </div>
        </div>
      )}

      {showResetDialog && (
        <div className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl bg-white shadow-2xl p-6 relative">
            <button
              onClick={closeResetDialog}
              disabled={resetting}
              className="absolute right-5 top-5 p-2 rounded-xl text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              aria-label="Tutup"
            >
              <X size={19} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 grid place-items-center">
              <AlertTriangle size={25} />
            </div>
            <h2 className="text-xl font-black text-gray-900 mt-4">Pilih data yang akan direset</h2>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              Reset berlaku ke website dan seluruh perangkat Android. Pilih cakupan dengan teliti karena data yang dihapus tidak dapat dikembalikan.
            </p>

            <div className="mt-5 grid gap-2">
              {Object.entries(RESET_OPTIONS).map(([type, option]) => {
                const OptionIcon = option.icon;
                const selected = resetType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setResetType(type);
                      setResetPhrase('');
                    }}
                    disabled={resetting}
                    className={`w-full rounded-2xl border p-4 text-left transition flex items-start gap-3 ${selected ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${selected ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <OptionIcon size={20} />
                    </span>
                    <span>
                      <span className="block font-black text-gray-900">{option.label}</span>
                      <span className="block text-xs text-gray-500 mt-1 leading-5">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <label className="block text-xs font-black text-gray-600 mb-2">Password Owner</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                disabled={resetting || !selectedReset}
                autoComplete="current-password"
                placeholder="Masukkan password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 disabled:bg-gray-100"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-black text-gray-600 mb-2">
                Ketik <span className="text-red-600">{selectedReset?.phrase || 'pilih jenis reset dahulu'}</span>
              </label>
              <input
                value={resetPhrase}
                onChange={(event) => setResetPhrase(event.target.value.toUpperCase())}
                disabled={resetting || !selectedReset}
                autoComplete="off"
                placeholder={selectedReset?.phrase || 'Pilih jenis reset'}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold tracking-wide focus:outline-none focus:border-red-500 disabled:bg-gray-100"
              />
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={closeResetDialog}
                disabled={resetting}
                className="flex-1 px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={resetData}
                disabled={resetting || !selectedReset || !resetPassword || resetPhrase.trim() !== selectedReset.phrase}
                className="flex-1 px-5 py-3 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                {resetting ? 'Mereset...' : selectedReset?.label || 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
