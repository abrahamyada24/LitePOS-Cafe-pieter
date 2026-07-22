"use client";

import { Clock3, Search, LogOut } from 'lucide-react';
import { showAlert } from '@/utils/swal';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Header({ search, setSearch, currentUser, shiftEnabled, activeShift }) {
    const router = useRouter();

    const handleLogout = async () => {
        const isConfirmed = await showAlert.confirm(
            'Keluar Kasir?',
            'Anda akan mengakhiri sesi kasir ini.',
            'Ya, Keluar'
        );

        if (isConfirmed) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            router.push('/login');
        }
    };

    return (
        <header className="h-16 lg:h-20 px-4 lg:px-6 flex items-center justify-between flex-shrink-0 bg-white border-b border-gray-100 shadow-sm z-20">
            <div className="flex items-center gap-3 lg:gap-4 w-full">
                <Link href="/" className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center flex-shrink-0" title="Kembali ke dashboard">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </Link>
                <Link href="/" className="hidden lg:block" title="Kembali ke dashboard">
                    <h1 className="text-xl font-bold leading-none tracking-tight">POS System</h1>
                    <p className="text-xs text-gray-400 font-medium mt-1">LitePOS</p>
                </Link>

                <div className="relative group flex-1 max-w-[200px] lg:max-w-xs ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Cari menu..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-gray-100 border-none rounded-lg lg:rounded-xl text-xs lg:text-sm w-full focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all outline-none font-medium placeholder:text-gray-400"
                    />
                </div>

                {shiftEnabled && activeShift && (
                    <Link
                        href="/shifts"
                        className="hidden sm:flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700"
                        title={`Shift dibuka oleh ${activeShift.userName}`}
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                        <Clock3 size={15} />
                        <span className="text-xs font-bold">Shift Aktif</span>
                    </Link>
                )}

                <div className="hidden lg:flex items-center gap-3 border-l border-gray-100 pl-4">
                    <div className="text-right hidden xl:block">
                        <p className="text-sm font-bold text-gray-800 leading-none">{currentUser?.name || 'Kasir'}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{currentUser?.role || 'Staff'}</p>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Keluar">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </header>
    );
}
