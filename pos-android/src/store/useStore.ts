import { create } from 'zustand';

export interface CartItem {
    id: number;
    name: string;
    price: number;
    costPrice?: number;
    quantity: number;
    notes?: string;
    cartItemId: string;
    stock: number;
    isUnlimitedStock: number;
}

interface StoreState {
    user: any;
    cart: CartItem[];
    discount: number;
    discountType: 'amount' | 'percent';
    activeShift: { id: string; openingCash: number; openedAt: string } | null;
    settings: {
        storeName: string;
        storeAddress: string;
        storePhone: string;
        storeLogo: string | null;
        enablePreOrder: boolean;
        enableShift: boolean;
        enableDineTable: boolean;
        showImages: boolean;
        printerAddress: string | null;
        printerType: 'BLE' | 'USB' | null;
        theme: 'light' | 'dark';
        allowNegativeStock: boolean;
        showLogoOnReceipt: boolean;
        receiptFooter: string;
        loyalty_active: boolean;
        loyalty_multiplier: number;
        loyalty_multiplier_amount: number;
        loyalty_point_value: number;
        loyalty_min_points: number;
        store_id?: string;
        license_expire_date?: string;
        license_type?: 'TRIAL' | 'PREMIUM';
        google_sheet_url?: string;
    };
    setSettings: (settings: any) => void;
    setUser: (user: any) => void;
    setActiveShift: (shift: { id: string; openingCash: number; openedAt: string } | null) => void;
    addToCart: (product: any) => void;
    addToCartNewLine: (product: any) => void;
    removeFromCart: (cartItemId: string) => void;
    updateCartQuantity: (cartItemId: string, qty: number) => void;
    updateCartItemNotes: (oldCartItemId: string, newNotes: string) => void;
    updateCartItem: (cartItemId: string, patch: { notes?: string; price?: number }) => void;
    clearCart: () => void;
    cartTotal: () => number;
    cartSubtotal: () => number;
    setDiscount: (amount: number, type: 'amount' | 'percent') => void;
    clearDiscount: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
    user: null,
    cart: [],
    discount: 0,
    discountType: 'amount',
    activeShift: null,
    settings: {
        storeName: 'LitePOS',
        storeAddress: '',
        storePhone: '',
        storeLogo: null,
        enablePreOrder: false,
        enableShift: true,
        enableDineTable: false,
        showImages: true,
        printerAddress: null,
        printerType: null,
        theme: 'light',
        allowNegativeStock: false,
        showLogoOnReceipt: true,
        receiptFooter: '',
        loyalty_active: false,
        loyalty_multiplier: 1,
        loyalty_multiplier_amount: 1000,
        loyalty_point_value: 0,
        loyalty_min_points: 0,
    },
    setSettings: (settings) => set({ settings }),
    setUser: (user) => set({ user }),
    setActiveShift: (shift) => set({ activeShift: shift }),
    addToCart: (product) => {
        const { cart } = get();
        const cartItemId = `${product.id}-${(product.notes || '').toLowerCase().trim()}`;
        const existing = cart.find(item => item.cartItemId === cartItemId);
        if (existing) {
            set({ cart: cart.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item) });
        } else {
            set({ cart: [...cart, { ...product, cartItemId, quantity: 1 }] });
        }
    },
    // Always adds a brand-new line (restaurant style) — never merges into existing
    addToCartNewLine: (product) => {
        const { cart } = get();
        const cartItemId = `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set({ cart: [...cart, { ...product, cartItemId, quantity: 1 }] });
    },
    updateCartItem: (cartItemId, patch) => {
        const { cart } = get();
        set({
            cart: cart.map(item =>
                item.cartItemId === cartItemId ? { ...item, ...patch } : item
            )
        });
    },
    removeFromCart: (cartItemId) => {
        const { cart } = get();
        set({ cart: cart.filter(item => item.cartItemId !== cartItemId) });
    },
    updateCartQuantity: (cartItemId, qty) => {
        const { cart } = get();
        if (qty <= 0) {
            set({ cart: cart.filter(item => item.cartItemId !== cartItemId) });
        } else {
            set({ cart: cart.map(item => item.cartItemId === cartItemId ? { ...item, quantity: qty } : item) });
        }
    },
    updateCartItemNotes: (oldCartItemId, newNotes) => {
        const { cart } = get();
        const itemToUpdate = cart.find(item => item.cartItemId === oldCartItemId);
        if (!itemToUpdate) return;

        const newCartItemId = `${itemToUpdate.id}-${(newNotes || '').toLowerCase().trim()}`;

        const existingMergeTarget = cart.find(item => item.cartItemId === newCartItemId && item.cartItemId !== oldCartItemId);

        if (existingMergeTarget) {
            set({
                cart: cart.map(item => {
                    if (item.cartItemId === newCartItemId) return { ...item, quantity: item.quantity + itemToUpdate.quantity };
                    return item;
                }).filter(item => item.cartItemId !== oldCartItemId)
            });
        } else {
            set({
                cart: cart.map(item => item.cartItemId === oldCartItemId ? { ...item, notes: newNotes, cartItemId: newCartItemId } : item)
            });
        }
    },
    clearCart: () => set({ cart: [], discount: 0, discountType: 'amount' }),
    cartSubtotal: () => {
        const { cart } = get();
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    },
    cartTotal: () => {
        const { cart, discount, discountType } = get();
        const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        if (discountType === 'percent') {
            return Math.max(0, subtotal - Math.round(subtotal * discount / 100));
        }
        return Math.max(0, subtotal - discount);
    },
    setDiscount: (amount, type) => set({ discount: amount, discountType: type }),
    clearDiscount: () => set({ discount: 0, discountType: 'amount' }),
}));
