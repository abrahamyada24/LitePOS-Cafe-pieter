"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Import Components
import Header from '@/components/pos/Header';
import CategoryFilter from '@/components/pos/CategoryFilter';
import ProductGrid from '@/components/pos/ProductGrid';
import CartSidebar from '@/components/pos/CartSidebar';
import MemberModal from '@/components/pos/MemberModal';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptPreviewModal from '@/components/pos/ReceiptPreviewModal';
import TableModal from '@/components/pos/TableModal';
import ShiftGuardModal from '@/components/pos/ShiftGuardModal';

// Import SweetAlert
import { showAlert } from '@/utils/swal';
import { useStore } from '@/store/useStore';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_URL = RAW_API_URL.endsWith('/api') ? RAW_API_URL.slice(0, -4) : RAW_API_URL;
const MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

export default function POSPage() {
  const router = useRouter(); 
  const authenticatedUser = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  
  // --- STATE DATA ---
  const [products, setProducts] = useState([]);
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); 
  const [storeSettings, setStoreSettings] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeShift, setActiveShift] = useState(null);
  const [shiftRequiredByServer, setShiftRequiredByServer] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  
  // --- STATE UI ---
  const [cart, setCart] = useState([]);
  const [pendingOrderContext, setPendingOrderContext] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [mobileView, setMobileView] = useState('menu'); 

  // Member State
  const [selectedMember, setSelectedMember] = useState(null);
  const [guestCustomerName, setGuestCustomerName] = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Payment States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState('SELECT'); 
  const [paymentMethod, setPaymentMethod] = useState(''); 
  const [cashGiven, setCashGiven] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Table & Order Type States
  const [orderType, setOrderType] = useState('TAKE_AWAY');
  const [selectedTable, setSelectedTable] = useState(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [preOrderDate, setPreOrderDate] = useState('');
  const [takeawayOptions, setTakeawayOptions] = useState([]);
  const [takeawayOption, setTakeawayOption] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const tableOrderRestoreStarted = useRef(false);

  // --- 1. FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token'); 
            setCurrentUser(authenticatedUser);

            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            const [prodRes, catRes, memRes, tableRes, pkgRes] = await Promise.all([
                fetch(`${API_URL}/api/products`, { headers }),
                fetch(`${API_URL}/api/products/categories`, { headers }),
                fetch(`${API_URL}/api/customers`, { headers }),
                fetch(`${API_URL}/api/tables`, { headers }),
                fetch(`${API_URL}/api/packages`, { headers })
            ]);

            const prodData = await prodRes.json();
            const catData = await catRes.json();
            const memData = await memRes.json();
            const tableData = await tableRes.json();
            const pkgData = await pkgRes.json();

            if (prodData.success) {
                const regularProducts = prodData.data.map(product => ({
                    ...product,
                    originalPrice: Number(product.originalPrice ?? product.price),
                    price: Number(product.effectivePrice ?? product.price)
                }));
                const packageProducts = pkgData.success ? pkgData.data.filter(pkg => pkg.isActive).map(pkg => ({
                    ...pkg,
                    id: `pkg-${pkg.id}`,
                    packageId: pkg.id,
                    category: { name: 'Paket' },
                    stock: 999,
                    isUnlimitedStock: true,
                    originalPrice: Number(pkg.price),
                    price: Number(pkg.price),
                    isPackage: true
                })) : [];
                setProducts([...regularProducts, ...packageProducts]);
            }
            if (catData.success) setCategories([{ id: 0, name: 'Semua' }, ...catData.data, ...(pkgData.success && pkgData.data.some(pkg => pkg.isActive) ? [{ id: 'PACKAGE', name: 'Paket' }] : [])]);
            if (memData.success) setMembers(memData.data);
            if (tableData.success) setTables(tableData.data.filter(t => t.status === 'AVAILABLE'));

            // Fetch settings for takeaway options and tax
            try {
                const settingsRes = await fetch(`${API_URL}/api/settings`, { headers });
                const settingsData = await settingsRes.json();
                
                if (settingsData.success && settingsData.data) {
                    setStoreSettings(settingsData.data);
                    if (settingsData.data.takeawayOptions) {
                        try {
                            const parsed = JSON.parse(settingsData.data.takeawayOptions);
                            setTakeawayOptions(Array.isArray(parsed) ? parsed : []);
                        } catch { setTakeawayOptions([]); }
                    }
                    if (settingsData.data.taxRate !== undefined && settingsData.data.taxRate !== null) {
                        setTaxRate(Number(settingsData.data.taxRate) / 100);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch settings', e);
            } finally {
                setSettingsLoaded(true);
            }

        } catch (error) {
            console.error("Error fetching data:", error);
            showAlert.error("Gagal Memuat Data", "Cek koneksi backend.");
            setSettingsLoaded(true);
        }
    };

    fetchData();

    // Load Midtrans
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY); 
    document.body.appendChild(script);

    return () => {
        if(document.body.contains(script)) document.body.removeChild(script);
    }
  }, [authenticatedUser]);

  useEffect(() => {
    if (!settingsLoaded) return undefined;
    if (storeSettings?.enableShift !== true) {
      setActiveShift(null);
      setShiftLoading(false);
      return undefined;
    }

    let cancelled = false;
    const loadCurrentShift = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/shifts/current`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await response.json();
        if (!cancelled && response.ok && data.success) setActiveShift(data.data || null);
      } catch (error) {
        console.error('Failed to fetch current shift', error);
      } finally {
        if (!cancelled) setShiftLoading(false);
      }
    };

    setShiftLoading(true);
    loadCurrentShift();
    const intervalId = window.setInterval(loadCurrentShift, 15000);
    const handleFocus = () => loadCurrentShift();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [settingsLoaded, storeSettings?.enableShift]);

  useEffect(() => {
    if (tableOrderRestoreStarted.current) return;
    const rawOrder = sessionStorage.getItem('table-order-to-process');
    if (!rawOrder) return;
    tableOrderRestoreStarted.current = true;

    const restoreTableOrder = async () => {
      try {
        const order = JSON.parse(rawOrder);
        const payload = typeof order.cartData === 'string' ? JSON.parse(order.cartData) : order.cartData;
        if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
          throw new Error('Isi order meja tidak valid.');
        }

        const restoredCart = payload.items.map((item, index) => {
          const packageId = item.packageId ? Number(item.packageId) : null;
          const productId = packageId ? `pkg-${packageId}` : Number(item.productId || item.id);
          return {
            ...item,
            id: productId,
            packageId,
            qty: Number(item.quantity || item.qty || 1),
            price: Number(item.price || 0),
            originalPrice: Number(item.originalPrice || item.price || 0),
            category: { name: item.categoryName || (packageId ? 'Paket' : 'Menu') },
            stock: Number(item.stock ?? (packageId ? 999 : 0)),
            isUnlimitedStock: packageId ? true : Boolean(Number(item.isUnlimitedStock)),
            cartItemId: item.cartItemId || `table-${order.id}-${index}`,
          };
        });

        const context = {
          savedOrderId: order.id,
          orderCode: payload.orderCode,
          queueLabel: payload.queueLabel,
          tableNumber: payload.tableNumber,
          customerName: payload.customerName,
          note: payload.note || null,
          accepted: sessionStorage.getItem('table-order-accepted-id') === String(order.id),
        };
        setCart(restoredCart);
        setPendingOrderContext(context);
        setOrderType('DINE_IN');
        setSelectedTable({ number: payload.tableNumber, name: payload.tableNumber });
        setSelectedMember(payload.customerName ? { id: null, name: payload.customerName, isTableGuest: true } : null);
        if (window.innerWidth < 1024) setMobileView('cart');

        if (context.accepted) return;

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/saved-transactions/${order.id}?action=accepted`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Order belum dapat diterima.');

        sessionStorage.setItem('table-order-accepted-id', String(order.id));
        setPendingOrderContext(current => current ? { ...current, accepted: true } : current);
        showAlert.success('Order diterima', `${payload.queueLabel || 'Order meja'} siap diproses di kasir.`);
      } catch (error) {
        await showAlert.error('Gagal membuka order meja', error.message || 'Kembali ke daftar Order Meja lalu coba lagi.');
        setCart([]);
        setPendingOrderContext(null);
        router.push('/order-meja');
      }
    };

    restoreTableOrder();
  }, [router]);

  // --- LOGIC FILTER ---
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.isActive === false) return false;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const categoryName = p.category ? p.category.name : 'Uncategorized';
      const matchCategory = selectedCategory === 'Semua' || categoryName === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [search, selectedCategory, products]);

  const filteredMembers = useMemo(() => {
      if(!memberSearch) return members;
      return members.filter(m => 
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
        (m.memberId && m.memberId.toLowerCase().includes(memberSearch.toLowerCase())) ||
        (m.phone && m.phone.includes(memberSearch))
      );
  }, [memberSearch, members]);

  // --- LOGIC CART ---
  const addToCart = (product) => {
    if (product.stock <= 0 && !product.isUnlimitedStock) return showAlert.warning("Stok Habis", "Produk ini tidak bisa dipilih.");
    
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        if (existing.qty + 1 > product.stock && !product.isUnlimitedStock) return showAlert.warning("Stok Terbatas", "Jumlah melebihi stok yang tersedia.");
        setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
        setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const updateQty = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id) || item;
        if (delta > 0 && item.qty + 1 > product.stock && !product.isUnlimitedStock) {
            showAlert.warning("Batas Stok", "Stok produk tidak mencukupi.");
            return item;
        }
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id));

  // --- CALCULATIONS ---
  const subTotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0);
  const taxAmount = subTotal * taxRate;
  const grandTotal = subTotal + taxAmount;
  
  const deficit = Math.max(0, grandTotal - cashGiven);
  const change = Math.max(0, cashGiven - grandTotal);
  const isCashSufficient = cashGiven >= grandTotal;

  // --- HELPERS ---
  const formatNumber = (num) => num.toLocaleString('id-ID');
  const handleCashInput = (e) => setCashGiven(Number(e.target.value.replace(/\D/g, '')));
  const getImageUrl = (path) => !path ? null : (path.startsWith('http') ? path : `${API_URL}${path}`);

  const buildReceiptTransaction = (transaction, type, customerName) => ({
      ...transaction,
      createdAt: transaction.createdAt || new Date().toISOString(),
      customerName: transaction.customerName || customerName || null,
      user: transaction.user || currentUser,
      items: cart.map(item => ({
          productId: item.id,
          qty: item.qty,
          price: Number(item.price),
          notes: item.notes || null,
          product: { name: item.name },
      })),
      payments: transaction.payments?.length
          ? transaction.payments
          : [{ paymentType: type, amount: grandTotal }],
      cashAmount: type === 'CASH' ? cashGiven : (transaction.cashAmount ?? grandTotal),
      changeAmount: type === 'CASH' ? change : (transaction.changeAmount ?? 0),
      subTotal: transaction.subTotal ?? subTotal,
      taxAmount: transaction.taxAmount ?? taxAmount,
      discountAmount: transaction.discountAmount ?? 0,
      grandTotal: transaction.grandTotal ?? grandTotal,
      orderType: transaction.orderType || orderType,
      tableNumber: transaction.tableNumber || selectedTable?.number || null,
  });

  // --- LOGOUT HANDLER (Sudah dipindah ke Header.jsx, tapi logic bisa disini jika butuh state) ---
  // Kita gunakan logic logout internal Header.jsx saja biar bersih.

  // --- TRANSAKSI ---
  const handleProcessTransaction = async (type) => {
      // Validasi Ekstra
      if (orderType === 'PRE_ORDER' && !preOrderDate) {
          return showAlert.warning("Waktu Kosong", "Silakan tentukan waktu pengambilan Pre Order.");
      }

      setIsProcessing(true);
      try {
          const token = localStorage.getItem('token');
          const userId = currentUser ? currentUser.id : 1; 
          
          const payload = {
              userId: userId, 
              customerId: selectedMember?.id || null,
              customerName: pendingOrderContext?.customerName || selectedMember?.name || guestCustomerName.trim() || null,
              items: cart.map(c => ({ productId: c.id, packageId: c.packageId || null, qty: c.qty, notes: c.notes || null })),
              payment: {
                type,
                amount: grandTotal,
                cashAmount: type === 'CASH' ? cashGiven : null,
                changeAmount: type === 'CASH' ? change : null,
              },
              orderType: orderType,
              tableNumber: orderType === 'DINE_IN' && selectedTable ? selectedTable.number : null,
              note: pendingOrderContext?.note || null,
              sourceOrderCode: pendingOrderContext?.orderCode || null,
              preOrderDate: orderType === 'PRE_ORDER' && preOrderDate ? new Date(preOrderDate).toISOString() : null,
              takeawayOption: orderType === 'TAKE_AWAY' && takeawayOption ? takeawayOption : null
          };

          const res = await fetch(`${API_URL}/api/transactions`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': token ? `Bearer ${token}` : ''
              },
              body: JSON.stringify(payload)
          });

          const data = await res.json();

          if (!data.success) {
              if (data.code === 'SHIFT_REQUIRED') {
                  setShiftRequiredByServer(true);
                  setActiveShift(null);
                  setShiftLoading(false);
              }
              throw new Error(data.message);
          }
          const receiptTransaction = buildReceiptTransaction(data.data, type, payload.customerName);

          if (pendingOrderContext?.orderCode) {
              sessionStorage.removeItem('table-order-to-process');
              sessionStorage.removeItem('table-order-accepted-id');
          }

          if (type === 'QRIS' && data.data.midtransToken) {
              window.snap.pay(data.data.midtransToken, {
                  onSuccess: function(result) {
                      setCompletedTransaction(receiptTransaction);
                      setPaymentStep('SUCCESS');
                      showAlert.success("Pembayaran Sukses", "Transaksi QRIS berhasil!");
                  },
                  onPending: function(result) {
                      setCompletedTransaction(receiptTransaction);
                      setPaymentStep('SUCCESS'); 
                      showAlert.info("Menunggu", "Pembayaran sedang diproses.");
                  },
                  onError: function(result) {
                      showAlert.error("Gagal", "Pembayaran gagal.");
                  },
                  onClose: function() {
                      showAlert.warning("Dibatalkan", "Anda menutup popup pembayaran.");
                  }
              });
          } else {
              setCompletedTransaction(receiptTransaction);
              setPaymentStep('SUCCESS');
              showAlert.success("Pembayaran Sukses", "Transaksi berhasil disimpan dan struk siap dicetak.");
          }

      } catch (error) {
          showAlert.error("Transaksi Gagal", error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleOpenShift = async () => {
    setIsOpeningShift(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/shifts/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ openingCash: Number(openingCash) || 0 })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Shift tidak dapat dibuka.');
      setActiveShift(data.data);
      setShiftRequiredByServer(false);
      setOpeningCash('');
      showAlert.success('Shift dibuka', `Kas awal Rp ${Number(data.data.openingCash || 0).toLocaleString('id-ID')}.`);
    } catch (error) {
      showAlert.error('Gagal membuka shift', error.message || 'Coba lagi.');
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handlePaymentOpen = () => {
    if (pendingOrderContext && !pendingOrderContext.accepted) {
      showAlert.warning('Order sedang diterima', 'Tunggu sebentar sampai order meja terkonfirmasi oleh server.');
      return;
    }
    setPaymentStep('SELECT');
    setPaymentMethod('');
    setCashGiven(0);
    setCompletedTransaction(null);
    setIsReceiptModalOpen(false);
    setIsPaymentModalOpen(true);
  }

  const resetTransaction = () => {
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(false);
      setCompletedTransaction(null);
      setCart([]);
      setSelectedMember(null);
      setGuestCustomerName('');
      setSelectedTable(null);
      setOrderType('TAKE_AWAY');
      setPreOrderDate('');
      setTakeawayOption('');
      setPendingOrderContext(null);
      sessionStorage.removeItem('table-order-to-process');
      sessionStorage.removeItem('table-order-accepted-id');
      setMobileView('menu');
      window.location.reload(); 
  }

  // Handle Member Select from Modal
  const handleMemberSelect = (member) => {
      setSelectedMember(member);
      setGuestCustomerName('');
      setIsMemberModalOpen(false);
      setMemberSearch('');
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 overflow-hidden font-sans text-gray-800">
      
      {/* KIRI: HEADER + KATEGORI + PRODUK */}
      <div className={`flex-1 flex flex-col min-w-0 relative ${mobileView !== 'menu' ? 'hidden lg:flex' : 'flex'}`}>
        <Header 
            search={search} 
            setSearch={setSearch} 
            currentUser={currentUser} 
            shiftEnabled={storeSettings?.enableShift === true || shiftRequiredByServer}
            activeShift={activeShift}
        />

        <CategoryFilter 
            categories={categories} 
            selectedCategory={selectedCategory} 
            setSelectedCategory={setSelectedCategory} 
        />

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6 bg-gray-50/50 pb-32 lg:pb-6">
            <ProductGrid 
                products={filteredProducts} 
                cart={cart}
                addToCart={addToCart} 
                updateQty={updateQty}
                getImageUrl={getImageUrl} 
            />
        </div>
      </div>

      {/* KANAN: SIDEBAR KERANJANG */}
      <CartSidebar 
        cart={cart}
        mobileView={mobileView}
        setMobileView={setMobileView}
        selectedMember={selectedMember}
        setSelectedMember={setSelectedMember}
        guestCustomerName={guestCustomerName}
        setGuestCustomerName={setGuestCustomerName}
        setIsMemberModalOpen={setIsMemberModalOpen}
        removeFromCart={removeFromCart}
        updateQty={updateQty}
        handlePaymentOpen={handlePaymentOpen}
        setCart={setCart}
        getImageUrl={getImageUrl}
        grandTotal={grandTotal}
        subTotal={subTotal}
        taxAmount={taxAmount}
        orderType={orderType}
        setOrderType={setOrderType}
        selectedTable={selectedTable}
        setIsTableModalOpen={setIsTableModalOpen}
        preOrderDate={preOrderDate}
        setPreOrderDate={setPreOrderDate}
        takeawayOptions={takeawayOptions}
        takeawayOption={takeawayOption}
        setTakeawayOption={setTakeawayOption}
        taxRate={taxRate}
        pendingOrderContext={pendingOrderContext}
        // Logout sekarang dihandle Header, tapi jika butuh di mobile menu:
        handleLogout={async () => {
            const confirmed = await showAlert.confirm('Keluar Kasir?', 'Sesi kasir akan diakhiri.', 'Ya, Keluar');
            if(confirmed) {
                await logout();
                router.push('/login');
            }
        }}
      />

      {/* --- MODALS --- */}

      <ShiftGuardModal
         visible={!settingsLoaded || ((storeSettings?.enableShift === true || shiftRequiredByServer) && (shiftLoading || !activeShift))}
         checking={!settingsLoaded || (shiftLoading && !shiftRequiredByServer)}
         opening={isOpeningShift}
         openingCash={openingCash}
         setOpeningCash={setOpeningCash}
         onOpenShift={handleOpenShift}
         currentUser={currentUser}
      />
      
      <MemberModal 
         isOpen={isMemberModalOpen}
         onClose={() => setIsMemberModalOpen(false)}
         memberSearch={memberSearch}
         setMemberSearch={setMemberSearch}
         filteredMembers={filteredMembers}
         handleMemberSelect={handleMemberSelect}
         getImageUrl={getImageUrl}
      />

      <PaymentModal 
         isOpen={isPaymentModalOpen}
         onClose={() => setIsPaymentModalOpen(false)}
         paymentStep={paymentStep}
         setPaymentStep={setPaymentStep}
         paymentMethod={paymentMethod}
         setPaymentMethod={setPaymentMethod}
         cashGiven={cashGiven}
         setCashGiven={setCashGiven}
         handleCashInput={handleCashInput}
         isCashSufficient={isCashSufficient}
         change={change}
         deficit={deficit}
         handleProcessTransaction={handleProcessTransaction}
         resetTransaction={resetTransaction}
         isProcessing={isProcessing}
         hasReceipt={Boolean(completedTransaction)}
         onOpenReceipt={() => setIsReceiptModalOpen(true)}
         grandTotal={grandTotal}
         formatNumber={formatNumber}
      />

      <ReceiptPreviewModal
         isOpen={isReceiptModalOpen}
         onClose={() => setIsReceiptModalOpen(false)}
         transaction={completedTransaction}
         store={storeSettings}
         formatNumber={formatNumber}
      />

      <TableModal 
         isOpen={isTableModalOpen}
         onClose={() => setIsTableModalOpen(false)}
         tables={tables}
         selectedTable={selectedTable}
         setSelectedTable={setSelectedTable}
      />

    </div>
  );
}
