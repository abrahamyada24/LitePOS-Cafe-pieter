"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { showAlert } from '@/utils/swal';
import { useStore } from '@/store/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ChangePasswordPage() {
  const router = useRouter();
  const logout = useStore((state) => state.logout);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      showAlert.error('Password Berbeda', 'Konfirmasi password baru belum sama.');
      return;
    }
    if (newPassword.length < 12) {
      showAlert.error('Password Terlalu Pendek', 'Gunakan minimal 12 karakter.');
      return;
    }

    setIsLoading(true);
    try {
      const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
      const response = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showAlert.error('Gagal Mengganti Password', data.message || 'Silakan coba lagi.');
        return;
      }
      await logout({ remote: false });
      sessionStorage.setItem('auth_notice', 'Password berhasil diganti. Silakan login menggunakan password baru.');
      router.replace('/login');
    } catch (_) {
      showAlert.error('Tidak Terhubung', 'Password belum dapat diganti.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center space-y-2 mb-7">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <LockKeyhole size={30} />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Amankan akun</h1>
        <p className="text-gray-500 text-sm">Password bawaan harus diganti sebelum melanjutkan.</p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <input
          type={showPassword ? 'text' : 'password'}
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 outline-none focus:border-blue-500"
          placeholder="Password lama"
          autoComplete="current-password"
          required
        />
        <input
          type={showPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 outline-none focus:border-blue-500"
          placeholder="Password baru, minimal 12 karakter"
          autoComplete="new-password"
          required
        />
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 outline-none focus:border-blue-500"
          placeholder="Ulangi password baru"
          autoComplete="new-password"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500"
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          {showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : 'Ganti Password'}
        </button>
      </form>
    </div>
  );
}
