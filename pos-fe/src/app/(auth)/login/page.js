"use client";

import { useEffect, useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showAlert } from '@/utils/swal';
import { useStore } from '@/store/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const login = useStore(state => state.login);

    useEffect(() => {
        const notice = sessionStorage.getItem('auth_notice');
        if (notice) {
            sessionStorage.removeItem('auth_notice');
            showAlert.info('Sesi Berakhir', notice);
        }
    }, []);

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await login(email, password);

            if (result.success) {
                showAlert.success("Berhasil", "Login berhasil.");
                router.push(result.mustChangePassword ? '/change-password' : '/');
            } else {
                showAlert.error("Gagal", result.message || "Login gagal.");
            }

        } catch (err) {
            console.error(err);
            showAlert.error("Error", "Gagal terhubung ke server backend.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Login POS</h1>
                <p className="text-gray-500 text-sm">Masuk sebagai Admin atau Kasir</p>
            </div>

            <form className="space-y-6 mt-6" onSubmit={handleLoginSubmit}>
                <div className="group relative transition-all">
                    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${email ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 bg-white group-hover:border-gray-300'}`}>
                        <Mail className="w-5 h-5 text-gray-400" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-gray-800 font-medium placeholder:text-gray-300"
                            placeholder="Email Address"
                            required
                        />
                    </div>
                </div>

                <div className="group relative transition-all">
                    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${password ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 bg-white group-hover:border-gray-300'}`}>
                        <Lock className="w-5 h-5 text-gray-400" />
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-gray-800 font-medium placeholder:text-gray-300"
                            placeholder="Password"
                            required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff size={20} className="text-gray-400" /> : <Eye size={20} className="text-gray-400" />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold text-lg shadow-xl shadow-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <>Masuk Sekarang <ArrowRight size={20} /></>}
                </button>
            </form>

            <div className="text-center mt-8">
                <p className="text-sm text-gray-500 font-medium">
                    Belum punya akun? <Link href="/register" className="text-blue-600 font-bold hover:underline">Hubungi Admin</Link>
                </p>
            </div>
        </div>
    );
}
