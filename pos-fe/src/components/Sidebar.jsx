"use client";

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingCart, Users, Settings,
  ChevronDown, Box, ClipboardList, UserCircle, LogOut, Utensils,
  Wallet, Clock, PackageCheck, ClipboardCheck, UtensilsCrossed, Truck, Gift,
  PlayCircle, Pause, AlertCircle, QrCode, ChefHat
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '../store/useStore';
import { showAlert } from '../utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const SidebarItem = ({ icon: Icon, label, href, hasSubmenu, isOpen, onClick, badge }) => {
  const pathname = usePathname();
  const isActive = href ? pathname === href : false;

  const content = (
    <div className="flex items-center gap-3">
      <Icon size={20} className={isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-600'} />
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
          {badge}
        </span>
      )}
    </div>
  );

  const className = `w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group mb-1 ${isActive || (hasSubmenu && isOpen)
    ? 'bg-blue-50 text-blue-600 font-bold'
    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium'
    }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
      {hasSubmenu && (
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      )}
    </button>
  );
};

export default function Sidebar({ isMobileOpen, setIsMobileOpen }) {
  const router = useRouter();
  const pathname = usePathname();

  // Menggunakan selector reaktif dari Zustand Store
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const settings = useStore((state) => state.settings);

  const [mounted, setMounted] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState({ inventory: true });
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [kitchenNewCount, setKitchenNewCount] = useState(0);

  // Pastikan komponen sudah terpasang (mounted) untuk menghindari error hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch pending saved transactions count
  useEffect(() => {
    if (!mounted) {
      setPendingSalesCount(0);
      setKitchenNewCount(0);
      return;
    }
    const fetchPendingSales = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
        const res = await fetch(`${baseUrl}/api/saved-transactions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setPendingSalesCount(Array.isArray(data.data) ? data.data.length : 0);
        }
        if (settings?.enableKitchenQueue) {
          const kitchenRes = await fetch(`${baseUrl}/api/kitchen-orders/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const kitchenData = await kitchenRes.json();
          if (kitchenData.success) setKitchenNewCount(Number(kitchenData.data?.NEW || 0));
        } else {
          setKitchenNewCount(0);
        }
      } catch (e) { /* silent */ }
    };
    fetchPendingSales();
    const interval = setInterval(fetchPendingSales, 30000);
    return () => clearInterval(interval);
  }, [mounted, settings?.enableTableOrder, settings?.enableKitchenQueue]);

  const toggleSubmenu = (key) => {
    setExpandedMenu(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    const confirm = await showAlert.confirm("Keluar Kasir?", "Sesi Anda akan berakhir.");
    if (confirm) {
      logout();
      router.push('/login');
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${API_URL}${path}`;
  };

  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const enableDineTable = settings?.enableDineTable;
  const enableTableOrder = settings?.enableTableOrder;
  const enableKitchenQueue = settings?.enableKitchenQueue;
  const enableShift = settings?.enableShift;

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="h-full flex flex-col">
          {/* Brand Header - Identik dengan Header Kasir */}
          <Link href="/" className="h-16 lg:h-20 flex items-center px-6 border-b border-gray-100 flex-shrink-0" title="Kembali ke dashboard">
            <div className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center flex-shrink-0 mr-3">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-none tracking-tight text-gray-800 truncate">LitePOS</h1>
              <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-wider truncate">Enterprise Suite</p>
            </div>
          </Link>

          {/* POS Quick Action Button */}
          <div className="px-4 pt-4 pb-2">
            <Link
              href="/pos"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
            >
              <ShoppingCart size={18} />
              Buka Kasir
              {pendingSalesCount > 0 && (
                <span className="bg-yellow-400 text-gray-900 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1">
                  {pendingSalesCount}
                </span>
              )}
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1 no-scrollbar">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" />

            {/* MANAGEMENT MENU: ADMIN AND OWNER ONLY */}
            {isAdminOrOwner && (
              <div className="pt-4 pb-2">
                <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 italic">Management</p>
                <SidebarItem
                  icon={Box}
                  label="Produk & Stok"
                  hasSubmenu
                  isOpen={expandedMenu.inventory}
                  onClick={() => toggleSubmenu('inventory')}
                />
                {expandedMenu.inventory && (
                  <div className="ml-4 pl-4 border-l border-gray-100 space-y-1 mt-1 mb-2">
                    <Link href="/products" className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${pathname === '/products' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}>Daftar Produk</Link>
                    <Link href="/packages" className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${pathname === '/packages' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}>Paket Produk</Link>
                    <Link href="/categories" className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${pathname === '/categories' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}>Kategori</Link>
                    <Link href="/stock" className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${pathname === '/stock' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}>Riwayat Stok</Link>
                    <Link href="/stock-receiving" className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${pathname === '/stock-receiving' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}>Penerimaan Barang</Link>
                    <Link href="/stock-opname" className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${pathname === '/stock-opname' ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}>Stock Opname</Link>
                  </div>
                )}
              </div>
            )}

            {/* TRANSACTIONS & REPORTS */}
            {enableTableOrder && (
              <SidebarItem icon={QrCode} label="Order Meja" href="/order-meja" badge={pendingSalesCount} />
            )}
            <SidebarItem icon={ShoppingCart} label="Transaksi" href="/transactions" />

            {isAdminOrOwner && (
              <SidebarItem icon={ClipboardList} label="Laporan" href="/reports" />
            )}

            <div className="pt-4 pb-2">
              <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 italic">Operasional</p>
              {enableShift && <SidebarItem icon={Clock} label="Shift" href="/shifts" />}
              {enableKitchenQueue && (
                <SidebarItem icon={ChefHat} label="Antrean Dapur" href="/kitchen" badge={kitchenNewCount} />
              )}
              {isAdminOrOwner && (
                <SidebarItem icon={Wallet} label="Pengeluaran" href="/expenses" />
              )}
              {enableDineTable && (
                <SidebarItem icon={UtensilsCrossed} label="Meja" href="/tables" />
              )}
            </div>

            {isAdminOrOwner && (
              <div className="pt-4 pb-2">
                <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 italic">People</p>
                <SidebarItem icon={Users} label="Pegawai" href="/users" />
                <SidebarItem icon={UserCircle} label="Pelanggan" href="/customers" />
                <SidebarItem icon={Truck} label="Supplier" href="/suppliers" />
              </div>
            )}

            {user?.role === 'OWNER' && (
              <SidebarItem icon={Settings} label="Pengaturan" href="/settings" />
            )}
          </div>

          {/* User Profile Area - Persis seperti Header (Clean & Mewah) */}
          <div className="p-4 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm flex-shrink-0 ring-4 ring-white">
                {mounted && user?.imageUrl ? (
                  <img src={getImageUrl(user.imageUrl)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black">{mounted && user?.name ? user.name.charAt(0).toUpperCase() : 'A'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate leading-none">
                  {mounted ? (user?.name || 'Authorized') : 'Loading...'}
                </p>
                <p className="text-[10px] text-gray-500 truncate font-medium mt-1.5 uppercase tracking-tighter">
                  {mounted ? (user?.role === 'CASHIER' ? 'STAFF' : user?.role || 'Staff Member') : 'Verifying...'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Keluar"
              >
                <LogOut size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileOpen(false)}></div>
      )}
    </>
  );
}
