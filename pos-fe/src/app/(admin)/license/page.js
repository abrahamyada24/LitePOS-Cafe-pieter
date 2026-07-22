"use client";

import { useEffect, useState } from 'react';
import { BadgeCheck, CalendarDays, CheckCircle2, Clock3, Copy, KeyRound, Loader2, MonitorSmartphone, ShieldAlert } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
  : 'Tanpa batas waktu';

export default function LicensePage() {
  const user = useStore((state) => state.user);
  const license = useStore((state) => state.license);
  const fetchLicenseStatus = useStore((state) => state.fetchLicenseStatus);
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const isOwner = user?.role === 'OWNER';

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
    </div>
  );
}
