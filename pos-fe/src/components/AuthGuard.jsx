"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useStore } from '@/store/useStore';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'litepos_last_activity';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrateSession = useStore((state) => state.hydrateSession);
  const fetchLicenseStatus = useStore((state) => state.fetchLicenseStatus);
  const logout = useStore((state) => state.logout);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const enforceRoleAccess = useCallback((user) => {
    if (user.mustChangePassword) {
      router.replace('/change-password');
      return false;
    }

    if (user.role === 'CASHIER') {
      const allowedPaths = ['/', '/pos', '/transactions', '/tables', '/shifts', '/order-meja', '/kitchen', '/settings', '/license'];
      const isAllowed = allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
      if (!isAllowed) {
        router.replace('/');
        return false;
      }
    }

    return true;
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const result = await hydrateSession();
      if (cancelled) return;
      if (!result.success) {
        sessionStorage.setItem('auth_notice', result.code === 'SESSION_IDLE_TIMEOUT'
          ? 'Sesi berakhir karena tidak aktif selama 30 menit.'
          : 'Silakan login kembali.');
        router.replace('/login');
        return;
      }
      if (!enforceRoleAccess(result.user)) return;

      const licenseResult = await fetchLicenseStatus();
      if (cancelled) return;
      if (!licenseResult.success || !licenseResult.data?.isActive) {
        if (pathname !== '/license') {
          router.replace('/license');
          return;
        }
      }
      setIsAuthorized(true);
    };
    verify();
    return () => { cancelled = true; };
  }, [enforceRoleAccess, fetchLicenseStatus, hydrateSession, pathname, router]);

  useEffect(() => {
    if (!isAuthorized) return undefined;
    let timerId;

    const endSession = async () => {
      await logout();
      sessionStorage.setItem('auth_notice', 'Sesi berakhir karena tidak aktif selama 30 menit.');
      router.replace('/login');
    };

    const scheduleTimeout = () => {
      window.clearTimeout(timerId);
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) {
        endSession();
        return;
      }
      timerId = window.setTimeout(endSession, remaining);
    };

    const markActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      scheduleTimeout();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleTimeout();
    };
    const handleStorage = (event) => {
      if (event.key === LAST_ACTIVITY_KEY) scheduleTimeout();
    };

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) markActivity();
    else scheduleTimeout();

    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity);
    window.addEventListener('touchstart', markActivity, { passive: true });
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('touchstart', markActivity);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthorized, logout, router]);

  useEffect(() => {
    if (!isAuthorized) return undefined;
    const verifyLicense = async () => {
      const result = await fetchLicenseStatus();
      if ((!result.success || !result.data?.isActive) && pathname !== '/license') {
        router.replace('/license');
      }
    };
    const intervalId = window.setInterval(verifyLicense, 5 * 60 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') verifyLicense();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchLicenseStatus, isAuthorized, pathname, router]);

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-3">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-sm font-medium">Memeriksa sesi aman...</p>
      </div>
    );
  }

  return <>{children}</>;
}
