"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    let user = null;

    // Baca dari Zustand persisted storage (pos-storage)
    if (typeof window !== 'undefined') {
      const storage = localStorage.getItem('pos-storage');
      if (storage) {
        try {
          const parsed = JSON.parse(storage);
          if (!token) token = parsed.state?.token;
          user = parsed.state?.user;
        } catch (e) { console.error("Gagal parse storage", e); }
      }
    }

    if (!token || !user) {
      router.replace('/login');
      return;
    }
    const role = user.role;

    // Staff / Cashier route access
    if (role === 'CASHIER') {
      const allowedPaths = ['/', '/pos', '/transactions', '/tables', '/shifts', '/order-meja', '/kitchen'];
      const isAllowed = allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!isAllowed) {
        router.replace('/');
        return;
      }
    }

    // Admin route access
    if (role === 'ADMIN') {
      if (pathname.startsWith('/settings')) {
        router.replace('/');
        return;
      }
    }
    setIsAuthorized(true);

  }, [router, pathname]);
  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-3">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-sm font-medium">Memeriksa akses...</p>
      </div>
    );
  }

  return <>{children}</>;
}
