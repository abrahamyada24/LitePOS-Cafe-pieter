import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const useStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      license: null,

      getHeaders: () => {
        const token = get().token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },

      login: async (email, password) => {
        try {
          // Fix URL parsing to avoid double /api/api
          const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, clientType: 'WEB', deviceName: 'Web POS' }),
          });
          const data = await res.json();

          if (data.success) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.setItem('litepos_last_activity', String(Date.now()));
            set({
              user: data.user,
              token: null,
              isAuthenticated: true,
              settings: null
            });

            if (!data.user?.mustChangePassword) await get().fetchSettings();
            return { success: true, mustChangePassword: Boolean(data.user?.mustChangePassword) };
          }
          return { success: false, message: data.message, code: data.code };
        } catch (error) {
          return { success: false, message: 'Gagal terhubung ke server' };
        }
      },

      logout: async ({ remote = true } = {}) => {
        if (remote) {
          try {
            const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
            await fetch(`${baseUrl}/api/auth/logout`, {
              method: 'POST',
              credentials: 'include',
            });
          } catch (_) { /* sesi lokal tetap dibersihkan */ }
        }
        set({ user: null, token: null, isAuthenticated: false, license: null, cart: [], settings: null, discount: 0, discountType: 'amount', activeShift: null });
        localStorage.removeItem('pos-storage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('litepos_last_activity');
      },

      hydrateSession: async () => {
        try {
          const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
          const response = await fetch(`${baseUrl}/api/auth/me`, {
            credentials: 'include',
            cache: 'no-store',
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            await get().logout({ remote: false });
            return { success: false, code: data.code };
          }
          set({ user: data.user, token: null, isAuthenticated: true });
          return { success: true, user: data.user };
        } catch (error) {
          return { success: false, code: 'NETWORK_ERROR' };
        }
      },

      products: [],
      categories: [],
      customers: [],
      settings: null,
      isLoading: false,

      fetchLicenseStatus: async () => {
        try {
          const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
          const response = await fetch(`${baseUrl}/api/license/status`, {
            credentials: 'include',
            cache: 'no-store',
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            return { success: false, message: data.message || 'Status lisensi tidak tersedia.' };
          }
          set({ license: data.data });
          return { success: true, data: data.data };
        } catch (error) {
          return { success: false, message: 'Tidak dapat memeriksa lisensi outlet.' };
        }
      },

      fetchSettings: async () => {
        try {
          const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
          const response = await fetch(`${baseUrl}/api/settings`, {
            headers: {
              'Cache-Control': 'no-cache'
            },
            credentials: 'include',
            cache: 'no-store'
          });
          const data = await response.json();

          if (response.status === 401) {
            await get().logout({ remote: false });
            return { success: false, message: 'Sesi berakhir' };
          }

          if (response.ok && data.success) {
            set({ settings: data.data });
            return { success: true, data: data.data };
          }

          return { success: false, message: data.message || data.error || 'Gagal mengambil pengaturan' };
        } catch (error) {
          console.error('Gagal mengambil pengaturan:', error);
          return { success: false, message: error.message };
        }
      },

      fetchDataMaster: async () => {
        const headers = get().getHeaders();

        if (!headers) {
          console.warn("Fetch dibatalkan: User belum login / Token tidak ada.");
          return;
        }

        set({ isLoading: true });
        try {
          const baseUrl = API_URL.endsWith('/api') ? API_URL.replace(/\/api$/, '') : API_URL;
          const [prodRes, catRes, custRes, setRes] = await Promise.all([
            fetch(`${baseUrl}/api/products`, { headers }),
            fetch(`${baseUrl}/api/products/categories`, { headers }),
            fetch(`${baseUrl}/api/customers`, { headers }),
            fetch(`${baseUrl}/api/settings`, { headers, cache: 'no-store' })
          ]);

          const prodData = await prodRes.json();
          const catData = await catRes.json();
          const custData = await custRes.json();
          const setData = await setRes.json();

          if (prodData.success) set({ products: prodData.data });
          else if (prodRes.status === 401) get().logout();

          // --- FIX: TETAP MENGHAPUS HARDCODED 'SEMUA' AGAR MANAJEMEN KATEGORI TIDAK BUG ---
          if (catData.success) set({ categories: catData.data });

          if (custData.success) set({ customers: custData.data });
          if (setData.success) set({ settings: setData.data });

        } catch (error) {
          console.error("Gagal ambil data master:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      // ═══════════════════════════════════════════════════════════
      // CART STATE & ACTIONS (Enhanced to match AndroidPos)
      // ═══════════════════════════════════════════════════════════
      cart: [],
      discount: 0,
      discountType: 'amount', // 'amount' or 'percent'

      addToCart: (product) => {
        const { cart, settings } = get();
        const allowNegativeStock = settings?.allowNegativeStock;
        const existing = cart.find((item) => item.id === product.id);

        if (product.stock <= 0 && !product.isUnlimitedStock && !allowNegativeStock) {
          return { success: false, message: 'Stok Habis' };
        }

        if (existing) {
          if (existing.qty + 1 > product.stock && !product.isUnlimitedStock && !allowNegativeStock) {
            return { success: false, message: 'Stok tidak cukup' };
          }

          set({
            cart: cart.map((item) =>
              item.id === product.id ? { ...item, qty: item.qty + 1 } : item
            ),
          });
        } else {
          set({ cart: [...cart, { ...product, qty: 1, notes: '', addons: [] }] });
        }
        return { success: true };
      },

      // Add to cart with a new unique line (restaurant-style)
      addToCartNewLine: (product) => {
        const { cart, settings } = get();
        const allowNegativeStock = settings?.allowNegativeStock;

        if (product.stock <= 0 && !product.isUnlimitedStock && !allowNegativeStock) {
          return { success: false, message: 'Stok Habis' };
        }

        const cartItemId = `${product.id}_${Date.now()}`;
        set({ cart: [...cart, { ...product, qty: 1, notes: '', addons: [], cartItemId }] });
        return { success: true };
      },

      updateCartQty: (productId, delta) => {
        const { cart, products, settings } = get();
        const allowNegativeStock = settings?.allowNegativeStock;

        set({
          cart: cart.map((item) => {
            if (item.id === productId) {
              const masterProduct = products.find(p => p.id === productId);
              if (delta > 0 && masterProduct && item.qty + 1 > masterProduct.stock && !masterProduct.isUnlimitedStock && !allowNegativeStock) {
                return item;
              }
              const newQty = Math.max(0, item.qty + delta);
              return { ...item, qty: newQty };
            }
            return item;
          }).filter((item) => item.qty > 0),
        });
      },

      updateCartItemNotes: (productId, notes) => {
        const { cart } = get();
        set({
          cart: cart.map((item) =>
            item.id === productId ? { ...item, notes } : item
          ),
        });
      },

      updateCartItemAddons: (productId, addons) => {
        const { cart } = get();
        set({
          cart: cart.map((item) =>
            item.id === productId ? { ...item, addons } : item
          ),
        });
      },

      removeFromCart: (productId) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== productId),
        }));
      },

      clearCart: () => set({ cart: [], discount: 0, discountType: 'amount' }),

      // Discount actions
      setDiscount: (amount, type = 'amount') => {
        set({ discount: amount, discountType: type });
      },

      clearDiscount: () => {
        set({ discount: 0, discountType: 'amount' });
      },

      getCartTotal: () => {
        const { cart, settings, discount, discountType } = get();
        const subTotal = cart.reduce((sum, item) => {
          const addonTotal = (item.addons || []).reduce((s, a) => s + Number(a.price || 0), 0);
          return sum + ((Number(item.price) + addonTotal) * item.qty);
        }, 0);

        // Calculate discount
        let discountAmount = 0;
        if (discountType === 'percent') {
          discountAmount = Math.round(subTotal * (discount / 100));
        } else {
          discountAmount = Number(discount) || 0;
        }
        discountAmount = Math.min(discountAmount, subTotal); // Can't exceed subtotal

        const taxRate = settings?.taxRate ? Number(settings.taxRate) / 100 : 0;
        const taxableAmount = subTotal - discountAmount;
        const tax = Math.round(taxableAmount * taxRate);

        return {
          subTotal,
          discountAmount,
          tax,
          grandTotal: taxableAmount + tax
        };
      },

      // ═══════════════════════════════════════════════════════════
      // SHIFT STATE (from AndroidPos)
      // ═══════════════════════════════════════════════════════════
      activeShift: null,

      setActiveShift: (shift) => set({ activeShift: shift }),

      clearActiveShift: () => set({ activeShift: null }),

    }),
    {
      name: 'pos-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        cart: state.cart,
        settings: state.settings,
        discount: state.discount,
        discountType: state.discountType,
        activeShift: state.activeShift
        ,license: state.license
      }),
      version: 2,
      migrate: (persistedState) => ({
        ...persistedState,
        token: null,
        isAuthenticated: false,
      }),
    }
  )
);
