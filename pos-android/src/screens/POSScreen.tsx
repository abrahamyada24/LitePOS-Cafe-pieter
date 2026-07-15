import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Alert, useWindowDimensions, Modal, TextInput, ScrollView, Animated, Vibration, PermissionsAndroid, Platform, RefreshControl } from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { useStore } from '../store/useStore';
import { syncService } from '../services/syncService';
import api, { resolveApiAssetUrl } from '../services/api';
import { getDBConnection } from '../database/db';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera, CameraType } from 'react-native-camera-kit';
import { printKitchenTicket } from '../utils/kitchenPrinter';
import { applyProductDiscount } from '../utils/productDiscount';

export default function POSScreen({ navigation, route }: any) {
    useAppColorScheme(tw);
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [pendingSales, setPendingSales] = useState<any[]>([]);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [packages, setPackages] = useState<any[]>([]);
    const [showPaketCategory, setShowPaketCategory] = useState(false);

    const [addonModalVisible, setAddonModalVisible] = useState(false);
    const [selectedProductForAddon, setSelectedProductForAddon] = useState<any>(null);
    const [addonNotes, setAddonNotes] = useState('');
    // Per-product add-ons
    const [productAddons, setProductAddons] = useState<any[]>([]);
    const [selectedAddons, setSelectedAddons] = useState<number[]>([]); // addon IDs
    const [addonProductItem, setAddonProductItem] = useState<any>(null);
    // Qty edit
    const [showQtyModal, setShowQtyModal] = useState(false);
    const [qtyInput, setQtyInput] = useState('');
    const [editingQtyItem, setEditingQtyItem] = useState<any>(null);

    // Barcode scanner state
    const [showScanner, setShowScanner] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeInputRef = useRef<TextInput>(null);
    const cameraScanLockedRef = useRef(false);

    // Mobile cart panel state
    const [mobileCartExpanded, setMobileCartExpanded] = useState(false);
    const { height: screenHeight } = useWindowDimensions();
    const expandedHeight = Math.round(screenHeight * 0.42);
    const collapsedHeight = 72;
    const cartPanelAnim = React.useRef(new Animated.Value(0)).current; // 0 = collapsed, 1 = expanded
    const [refreshing, setRefreshing] = useState(false);
    const [isPrintingKitchen, setIsPrintingKitchen] = useState(false);

    const cart = useStore((state) => state.cart);
    const settings = useStore((state) => state.settings);
    const addToCart = useStore((state) => state.addToCart);
    const addToCartNewLine = useStore((state) => state.addToCartNewLine);
    const updateCartQuantity = useStore((state) => state.updateCartQuantity);
    const updateCartItemNotes = useStore((state) => state.updateCartItemNotes);
    const updateCartItem = useStore((state) => state.updateCartItem);
    const clearCart = useStore((state) => state.clearCart);
    const setPendingOrderContext = useStore((state) => state.setPendingOrderContext);
    const pendingOrderContext = useStore((state) => state.pendingOrderContext);
    const cartTotal = useStore((state) => state.cartTotal());
    const cartSubtotal = useStore((state) => state.cartSubtotal());
    const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    const formatRp = (num: number) => 'Rp ' + (Math.round(num) || 0).toLocaleString('id-ID');

    const parsePendingCartPayload = (cartData: string) => {
        try {
            const parsed = JSON.parse(cartData || '[]');
            if (Array.isArray(parsed)) {
                return { items: parsed, meta: {} as any };
            }
            return {
                items: Array.isArray(parsed.items) ? parsed.items : [],
                meta: parsed || {} as any,
            };
        } catch {
            return { items: [], meta: {} as any };
        }
    };

    const getPendingMeta = (pending: any) => parsePendingCartPayload(pending.cartData).meta;
    const getPendingItemCount = (pending: any) => parsePendingCartPayload(pending.cartData).items.length;
    const isTablePendingOrder = (pending: any) => {
        const meta = getPendingMeta(pending);
        return meta?.source === 'TABLE_QR' || Boolean(meta?.tableNumber);
    };
    const getPendingDisplayName = (pending: any) => {
        const meta = getPendingMeta(pending);
        if (meta?.tableNumber) {
            const customer = meta.customerName || 'Pelanggan';
            return `Meja ${meta.tableNumber} - ${customer}`;
        }
        return pending.name || 'Order Pending';
    };

    const resolvePendingCartItems = async (items: any[]) => {
        const db = await getDBConnection();
        const resolvedItems: any[] = [];

        for (const item of items) {
            let localProduct: any = null;
            const serverProductId = Number(item.serverProductId || item.productId);
            const localProductId = Number(item.id || item.productId);

            if (serverProductId && !Number.isNaN(serverProductId)) {
                const [serverRes] = await db.executeSql('SELECT * FROM products WHERE serverId = ? LIMIT 1', [serverProductId]);
                if (serverRes.rows.length > 0) localProduct = serverRes.rows.item(0);
            }

            if (!localProduct && localProductId && !Number.isNaN(localProductId)) {
                const [localRes] = await db.executeSql('SELECT * FROM products WHERE id = ? LIMIT 1', [localProductId]);
                if (localRes.rows.length > 0) localProduct = localRes.rows.item(0);
            }

            const quantity = Math.max(1, Number(item.quantity || item.qty || 1));
            resolvedItems.push({
                ...(localProduct || item),
                id: localProduct?.id || item.id || item.productId,
                name: localProduct?.name || item.name || item.productName || 'Produk',
                price: Number(item.price ?? localProduct?.price ?? 0),
                basePrice: Number(item.basePrice ?? item.price ?? localProduct?.price ?? 0),
                stock: localProduct?.stock ?? item.stock ?? 999,
                isUnlimitedStock: localProduct?.isUnlimitedStock ?? item.isUnlimitedStock ?? 1,
                imageUrl: localProduct?.imageUrl ?? item.imageUrl ?? null,
                notes: item.notes || undefined,
                quantity,
                cartItemId: `${localProduct?.id || item.id || item.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            });
        }

        return resolvedItems;
    };

    const getProductCartId = (product: any) => product._isPackage ? `pkg-${product.id}` : product.id;
    const getProductCartItems = (product: any) => {
        const productCartId = String(getProductCartId(product));
        return cart.filter(item => String(item.id) === productCartId);
    };
    const getProductCartQuantity = (product: any) => (
        getProductCartItems(product).reduce((total, item) => total + item.quantity, 0)
    );
    const sortSelectedProductsFirst = (items: any[]) => items
        .map((item, index) => ({
            item,
            index,
            cartIndex: cart.findIndex(cartItem => String(cartItem.id) === String(getProductCartId(item))),
        }))
        .sort((a, b) => {
            const aSelected = a.cartIndex >= 0;
            const bSelected = b.cartIndex >= 0;
            if (aSelected !== bSelected) return aSelected ? -1 : 1;
            if (aSelected && bSelected && a.cartIndex !== b.cartIndex) return a.cartIndex - b.cartIndex;
            return a.index - b.index;
        })
        .map(entry => entry.item);

    const filteredProducts = (() => {
        let visibleProducts: any[];
        if (showPaketCategory) {
            // Show active packages as sellable items
            const pkgs = packages.map(pkg => ({
                ...pkg,
                _isPackage: true,
                isUnlimitedStock: 1,
                stock: 999,
            }));
            visibleProducts = searchQuery.trim()
                ? pkgs.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                : pkgs;
        } else {
            visibleProducts = searchQuery.trim()
                ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                : products;
        }

        return sortSelectedProductsFirst(visibleProducts);
    })();

    const loadData = useCallback(async () => {
        try {
            const db = await getDBConnection();
            
            // Exclude "Bahan Baku" (Raw Materials) from the POS Category tabs
            const [catResults] = await db.executeSql("SELECT * FROM categories WHERE LOWER(name) NOT LIKE '%bahan baku%'");
            const cats: any[] = [];
            for (let i = 0; i < catResults.rows.length; i++) cats.push(catResults.rows.item(i));
            setCategories(cats);

            // Fetch products, excluding those in "Bahan Baku" categories
            let prodQuery = `
                SELECT p.* FROM products p
                JOIN categories c ON p.categoryId = c.id
                WHERE LOWER(c.name) NOT LIKE '%bahan baku%'
            `;
            if (selectedCategory) prodQuery += ` AND p.categoryId = ${selectedCategory}`;
            
            const [prodResults] = await db.executeSql(prodQuery);
            const prods: any[] = [];
            for (let i = 0; i < prodResults.rows.length; i++) prods.push(prodResults.rows.item(i));
            setProducts(prods.map(applyProductDiscount));

            // Load local pending sales
            const [pendingRes] = await db.executeSql('SELECT * FROM saved_transactions ORDER BY createdAt DESC');
            const pending: any[] = [];
            for (let i = 0; i < pendingRes.rows.length; i++) {
                const localPending = pendingRes.rows.item(i);
                const localMeta = parsePendingCartPayload(localPending.cartData).meta;
                const isTableOrder = localMeta?.source === 'TABLE_QR' || Boolean(localMeta?.tableNumber);
                if (isTableOrder && !settings.enableTableOrder) continue;
                pending.push({ ...localPending, source: 'local' });
            }

            // Load server pending orders, including table QR orders submitted from public catalog
            try {
                const remoteRes = await api.get('/saved-transactions');
                if (remoteRes.data?.success && Array.isArray(remoteRes.data.data)) {
                    for (const remote of remoteRes.data.data) {
                        const remoteMeta = parsePendingCartPayload(remote.cartData).meta;
                        const isTableOrder = remoteMeta?.source === 'TABLE_QR' || Boolean(remoteMeta?.tableNumber);
                        if (isTableOrder && !settings.enableTableOrder) continue;
                        pending.push({
                            id: remote.id,
                            name: remote.name,
                            cartData: remote.cartData,
                            createdAt: remote.createdAt,
                            source: 'server',
                            user: remote.user
                        });
                    }
                }
            } catch (remoteError: any) {
                console.warn('Gagal mengambil order pending server:', remoteError?.message || remoteError);
            }

            setPendingSales(pending);

            // Load active packages
            const [pkgRes] = await db.executeSql(`
                SELECT p.*, 
                    (SELECT COUNT(*) FROM package_items pi WHERE pi.packageId = p.id) as itemCount
                FROM packages p WHERE p.isActive = 1 ORDER BY p.name
            `);
            const pkgs: any[] = [];
            for (let i = 0; i < pkgRes.rows.length; i++) pkgs.push(pkgRes.rows.item(i));
            setPackages(pkgs);
        } catch (error) {
            console.error(error);
        }
    }, [selectedCategory, settings.enableTableOrder]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadData);
        return unsubscribe;
    }, [navigation, loadData]);

    useEffect(() => {
        if (route?.params?.openPendingOrders) {
            setShowPendingModal(true);
            navigation.setParams?.({ openPendingOrders: false });
        }
    }, [navigation, route?.params?.openPendingOrders]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await syncService.syncMasterData();
            await loadData();
        } catch (e) {
            console.error('Failed to sync on refresh', e);
        } finally {
            setRefreshing(false);
        }
    }, [loadData]);

    // Tap product → add directly to cart as a new line (no modal)
    const handleProductPress = async (item: any) => {
        // Handle package items
        if (item._isPackage) {
            try {
                const db = await getDBConnection();
                const [piRes] = await db.executeSql(`
                    SELECT pi.*, pr.name as productName, pr.price as productPrice, pr.stock, pr.isUnlimitedStock
                    FROM package_items pi
                    LEFT JOIN products pr ON pi.productId = pr.id
                    WHERE pi.packageId = ?
                `, [item.id]);
                if (piRes.rows.length === 0) {
                    Alert.alert('Paket Kosong', 'Paket ini belum memiliki produk.');
                    return;
                }
                // Add as single cart line with package info
                addToCartNewLine({
                    id: `pkg-${item.id}`,
                    name: `[Paket] ${item.name}`,
                    price: item.price,
                    stock: 999,
                    isUnlimitedStock: 1,
                    imageUrl: null,
                    notes: `Paket: ${Array.from({ length: piRes.rows.length }, (_, i) => piRes.rows.item(i))
                        .map(pi => `${pi.productName} x${pi.quantity}`).join(', ')}`,
                });
            } catch (e) {
                console.error(e);
                Alert.alert('Error', 'Gagal menambahkan paket.');
            }
            return;
        }
        if (item.isUnlimitedStock !== 1 && item.stock <= 0 && !settings.allowNegativeStock) {
            Alert.alert('Stok Habis', 'Stok produk ini sedang kosong.');
            return;
        }
        const productPcsInCart = cart.filter(c => c.id === item.id).reduce((acc, c) => acc + c.quantity, 0);
        if (item.isUnlimitedStock !== 1 && !settings.allowNegativeStock && productPcsInCart >= item.stock) {
            Alert.alert('Batas Stok', 'Batas maksimal stok yang tersedia telah tercapai.');
            return;
        }
        // Gabung QTY jika item sama (retail style)
        addToCart(item);
    };

    // Tap cart item → open add-on + notes modal for that specific cart line
    const handleEditCartItem = async (cartItem: any) => {
        try {
            const db = await getDBConnection();
            const [aRes] = await db.executeSql('SELECT * FROM product_addons WHERE productId = ? ORDER BY id', [cartItem.id]);
            const addons: any[] = [];
            for (let i = 0; i < aRes.rows.length; i++) addons.push(aRes.rows.item(i));
            setProductAddons(addons);
            setSelectedAddons([]);
            setAddonNotes(cartItem.notes || '');
            setAddonProductItem(null);       // not a new product — it's an existing cart line
            setSelectedProductForAddon(cartItem); // use this to track which cart line we're editing
            setAddonModalVisible(true);
        } catch {
            // No DB → just open notes
            setProductAddons([]);
            setSelectedAddons([]);
            setAddonNotes(cartItem.notes || '');
            setAddonProductItem(null);
            setSelectedProductForAddon(cartItem);
            setAddonModalVisible(true);
        }
    };

    // Confirm editing add-ons + notes for an existing cart item
    const handleConfirmCartEdit = () => {
        if (!selectedProductForAddon) return;
        const chosenAddons = productAddons.filter(a => selectedAddons.includes(a.id));
        const extraPrice = chosenAddons.reduce((sum, a) => sum + a.price, 0);
        const addonLabel = chosenAddons.map(a => a.name).join(', ');
        const noteStr = [addonLabel, addonNotes.trim()].filter(Boolean).join(' | ');
        // Base price = original product price (strip any previous add-on price)
        const basePrice = selectedProductForAddon.basePrice ?? selectedProductForAddon.price;
        updateCartItem(selectedProductForAddon.cartItemId, {
            notes: noteStr || undefined,
            price: basePrice + extraPrice,
            // Also store basePrice so re-editing doesn't double-add prices
            ...({ basePrice } as any),
        });
        setAddonModalVisible(false);
        setSelectedProductForAddon(null);
        setProductAddons([]);
        setSelectedAddons([]);
        setAddonNotes('');
    };

    const handleUpdateQuantity = (item: any, qty: number) => {
        const productPcsInCart = cart.filter(c => c.id === item.id).reduce((acc, c) => acc + c.quantity, 0);
        const difference = qty - item.quantity;
        if (difference > 0 && item.isUnlimitedStock !== 1 && !settings.allowNegativeStock && (productPcsInCart + difference) > item.stock) {
            Alert.alert('Batas Stok', 'Batas maksimal stok yang tersedia telah tercapai.');
            return;
        }
        updateCartQuantity(item.cartItemId, qty);
    };

    const handleDecreaseProduct = (product: any) => {
        const productCartItems = getProductCartItems(product);
        const targetItem = productCartItems[productCartItems.length - 1];
        if (!targetItem) return;
        handleUpdateQuantity(targetItem, targetItem.quantity - 1);
    };

    const renderProductControls = (product: any, compact = false) => {
        const quantity = getProductCartQuantity(product);
        const controlWidth = compact ? 112 : undefined;

        if (quantity === 0) {
            return (
                <TouchableOpacity
                    style={[tw`h-9 rounded-lg bg-blue-600 flex-row items-center justify-center`, controlWidth ? { width: controlWidth } : tw`w-full`]}
                    onPress={(event) => {
                        event.stopPropagation();
                        handleProductPress(product);
                    }}
                >
                    <Icon name="plus" size={15} color="white" />
                    <Text style={tw`text-white font-black text-xs ml-1`}>Tambah</Text>
                </TouchableOpacity>
            );
        }

        return (
            <View
                style={[
                    tw`h-9 rounded-lg border border-blue-600 flex-row items-center overflow-hidden bg-white dark:bg-gray-900`,
                    controlWidth ? { width: controlWidth } : tw`w-full`,
                ]}
            >
                <TouchableOpacity
                    style={tw`h-full flex-1 items-center justify-center`}
                    onPress={(event) => {
                        event.stopPropagation();
                        handleDecreaseProduct(product);
                    }}
                >
                    <Icon name="minus" size={15} color={tw.color('blue-700')} />
                </TouchableOpacity>
                <View style={tw`h-full min-w-[34px] px-2 items-center justify-center bg-blue-50 dark:bg-blue-900/30`}>
                    <Text style={tw`text-blue-800 dark:text-blue-200 font-black text-sm`}>{quantity}</Text>
                </View>
                <TouchableOpacity
                    style={tw`h-full flex-1 items-center justify-center bg-blue-600`}
                    onPress={(event) => {
                        event.stopPropagation();
                        handleProductPress(product);
                    }}
                >
                    <Icon name="plus" size={15} color="white" />
                </TouchableOpacity>
            </View>
        );
    };

    const handleBarcodeSubmit = async (code: string) => {
        if (!code.trim()) return;
        try {
            const db = await getDBConnection();
            const [res] = await db.executeSql('SELECT * FROM products WHERE barcode = ?', [code.trim()]);
            if (res.rows.length > 0) {
                const product = res.rows.item(0);
                handleProductPress(product); // re-use existing logic
                Vibration.vibrate(100); // haptic feedback on successful scan
                setBarcodeInput('');
                // Keep the scanner open if they want to scan more, just clear the input
            } else {
                Alert.alert('Tidak Ditemukan', `Produk dengan barcode ${code} tidak ditemukan.`);
                setBarcodeInput('');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Gagal mencari barcode.');
        }
    };

    const openScannerPanel = () => {
        setBarcodeInput('');
        setShowScanner(true);
        setTimeout(() => barcodeInputRef.current?.focus(), 300);
    };

    const handleOpenCamera = async () => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                    title: 'Izin Kamera',
                    message: 'Kamera diperlukan untuk memindai barcode produk.',
                    buttonNegative: 'Batal',
                    buttonPositive: 'Izinkan',
                }
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert('Izin Ditolak', 'Aktifkan izin kamera untuk menggunakan scan barcode.');
                return;
            }
        }

        cameraScanLockedRef.current = false;
        setShowCamera(true);
    };

    const handleCameraBarcodeRead = async (event: any) => {
        if (cameraScanLockedRef.current) return;
        const code = event?.nativeEvent?.codeStringValue;
        if (!code) return;

        cameraScanLockedRef.current = true;
        await handleBarcodeSubmit(code);
        setShowCamera(false);
        setShowScanner(false);
        setTimeout(() => {
            cameraScanLockedRef.current = false;
        }, 500);
    };

    const handlePrintKitchen = async () => {
        if (isPrintingKitchen || cart.length === 0) return;
        setIsPrintingKitchen(true);
        try {
            await printKitchenTicket(settings, cart, {
                tableNumber: pendingOrderContext?.tableNumber,
                customerName: pendingOrderContext?.customerName,
                orderName: pendingOrderContext?.source === 'TABLE_QR' ? 'ORDER MEJA' : undefined,
                queueLabel: pendingOrderContext?.queueLabel,
            });
            Alert.alert('Berhasil', 'Tiket dapur berhasil dicetak.');
        } catch (error: any) {
            Alert.alert('Gagal Cetak Dapur', error?.message || 'Periksa koneksi printer di Pengaturan.');
        } finally {
            setIsPrintingKitchen(false);
        }
    };



    const resumePendingSale = async (pending: any) => {
        try {
            const { items, meta } = parsePendingCartPayload(pending.cartData);
            const cartData = await resolvePendingCartItems(items);
            clearCart();
            for (const item of cartData) {
                addToCartNewLine(item);
            }

            if (meta?.source === 'TABLE_QR' || meta?.tableNumber) {
                setPendingOrderContext({
                    source: meta.source || pending.source,
                    orderType: 'DINE_IN',
                    tableNumber: meta.tableNumber,
                    customerName: meta.customerName,
                    note: meta.note,
                    orderCode: meta.orderCode,
                    queueNumber: meta.queueNumber,
                    queueLabel: meta.queueLabel,
                });
            }

            let kitchenPrintError: any = null;
            if ((meta?.source === 'TABLE_QR' || meta?.tableNumber) && settings.enableKitchenPrint) {
                try {
                    await printKitchenTicket(settings, cartData, {
                        tableNumber: meta.tableNumber,
                        customerName: meta.customerName,
                        orderName: 'ORDER MEJA',
                        queueLabel: meta.queueLabel,
                    });
                } catch (printError) {
                    kitchenPrintError = printError;
                }
            }

            if (pending.source === 'server') {
                await api.delete(`/saved-transactions/${pending.id}?action=accepted`);
            } else {
                const db = await getDBConnection();
                await db.executeSql('DELETE FROM saved_transactions WHERE id = ?', [pending.id]);
            }
            loadData();
            setShowPendingModal(false);
            if (kitchenPrintError) {
                Alert.alert(
                    'Order Masuk ke Kasir',
                    `Cetak dapur gagal: ${kitchenPrintError?.message || 'Periksa koneksi printer.'}`,
                );
            }
        } catch (e) {
            Alert.alert('Error', 'Gagal melanjutkan penjualan tersimpan.');
        }
    };

    useEffect(() => {
        const pendingOrder = route?.params?.pendingOrder;
        if (!pendingOrder) return;

        navigation.setParams?.({ pendingOrder: undefined });
        resumePendingSale(pendingOrder);
    }, [route?.params?.pendingOrder]);

    const deletePendingSale = async (pending: any) => {
        Alert.alert('Hapus', 'Hapus penjualan yang disimpan ini?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Hapus', style: 'destructive', onPress: async () => {
                    if (pending.source === 'server') {
                        await api.delete(`/saved-transactions/${pending.id}`);
                    } else {
                        const db = await getDBConnection();
                        await db.executeSql('DELETE FROM saved_transactions WHERE id = ?', [pending.id]);
                    }
                    loadData();
                }
            }
        ]);
    };

    const renderProduct = ({ item }: { item: any }) => {
        const quantity = getProductCartQuantity(item);
        const selectedCardStyle = quantity > 0
            ? 'border-blue-500 bg-blue-50 dark:bg-gray-800'
            : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800';

        if (!settings.showImages) {
            return (
                <TouchableOpacity
                    style={tw`flex-row m-2 rounded-xl overflow-hidden border shadow-sm items-center p-3 ${selectedCardStyle}`}
                    onPress={() => handleProductPress(item)}
                >
                    <View style={tw`flex-1`}>
                        <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-[15px]`} numberOfLines={1}>{item.name}</Text>
                        {item.isDiscountActive && <Text style={tw`text-gray-400 line-through text-[10px] mt-1`}>{formatRp(item.originalPrice)}</Text>}
                        <Text style={tw`${item.isDiscountActive ? 'text-red-600' : 'text-blue-600'} font-bold mt-0.5 text-xs`}>{formatRp(item.price)}</Text>
                        <Text style={tw`text-gray-400 dark:text-gray-500 text-[10px] mt-1`}>Stok: {item.isUnlimitedStock === 1 ? '∞' : item.stock}</Text>
                    </View>
                    {renderProductControls(item, true)}
                </TouchableOpacity>
            );
        }
        const numCols = isTablet ? 3 : 2;
        return (
            <View style={{ flex: 1 / numCols, padding: 8 }}>
                <TouchableOpacity
                    style={tw`rounded-xl overflow-hidden border shadow-sm ${selectedCardStyle}`}
                    onPress={() => handleProductPress(item)}
                >
                    <View style={tw`h-32 bg-gray-100 dark:bg-gray-800 items-center justify-center relative`}>
                        {item.imageUrl ? (
                            <Image
                                source={{ uri: resolveApiAssetUrl(item.imageUrl, settings.apiBaseUrl) || undefined }}
                                style={tw`w-full h-full`}
                            />
                        ) : (
                            <Text style={tw`text-gray-400 dark:text-gray-500 text-xs uppercase tracking-widest font-bold`}>NO IMG</Text>
                        )}
                        {quantity > 0 && (
                            <View style={tw`absolute top-2 left-2 bg-blue-600 rounded-full px-2 py-1`}>
                                <Text style={tw`text-white text-[10px] font-black`}>DIPILIH</Text>
                            </View>
                        )}
                        {item.isDiscountActive && (
                            <View style={tw`absolute top-2 right-2 bg-red-600 rounded-lg px-2 py-1`}>
                                <Text style={tw`text-white text-[9px] font-black`}>{item.discountLabel || 'PROMO'}</Text>
                            </View>
                        )}
                    </View>
                    <View style={tw`p-3 min-h-[116px] justify-between`}>
                        <View>
                        <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-sm`} numberOfLines={1}>{item.name}</Text>
                        {item.isDiscountActive && <Text style={tw`text-gray-400 line-through text-[10px] mt-1`}>{formatRp(item.originalPrice)}</Text>}
                        <Text style={tw`${item.isDiscountActive ? 'text-red-600' : 'text-blue-600'} font-bold mt-0.5 text-xs`}>{formatRp(item.price)}</Text>
                        <Text style={tw`text-gray-400 dark:text-gray-500 text-[10px] mt-1`}>Stok: {item.isUnlimitedStock === 1 ? '∞' : item.stock}</Text>
                        </View>
                        <View style={tw`mt-2`}>
                            {renderProductControls(item)}
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const renderCartItem = ({ item }: { item: any }) => (
        <View style={tw`flex-row justify-between items-center p-3 border-b border-gray-100 dark:border-gray-800`}>
            <View style={tw`flex-1 mr-2`}>
                {/* Tap name → open add-on + notes edit modal */}
                <TouchableOpacity onPress={() => handleEditCartItem(item)} activeOpacity={0.7}>
                    <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-sm`} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.notes ? (
                        <Text style={tw`text-[10px] text-blue-500 italic mt-0.5`} numberOfLines={2}>{item.notes}</Text>
                    ) : (
                        <Text style={tw`text-[10px] text-gray-400 italic mt-0.5`}>Tap untuk add-on / catatan</Text>
                    )}
                </TouchableOpacity>
                <Text style={tw`text-blue-600 font-bold text-xs mt-0.5`}>{formatRp(item.price)}</Text>
            </View>
            <View style={tw`flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700`}>
                <TouchableOpacity onPress={() => handleUpdateQuantity(item, item.quantity - 1)} style={tw`p-1 bg-white dark:bg-gray-800 rounded shadow-sm`}>
                    <Icon name="minus" size={14} color={tw.color('gray-800')} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        setEditingQtyItem(item);
                        setQtyInput(item.quantity.toString());
                        setShowQtyModal(true);
                    }}
                    style={tw`px-2`}
                >
                    <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-base min-w-[24px] text-center`}>{item.quantity}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleUpdateQuantity(item, item.quantity + 1)} style={tw`p-1 bg-white dark:bg-gray-800 rounded shadow-sm`}>
                    <Icon name="plus" size={14} color={tw.color('gray-800')} />
                </TouchableOpacity>
            </View>
            <Text style={tw`font-black text-gray-800 dark:text-gray-100 text-sm w-20 text-right ml-2`}>{formatRp(item.price * item.quantity)}</Text>
        </View>
    );

    const renderProductsPane = () => (
        <View style={tw`flex-1 bg-gray-50 dark:bg-gray-900`}>
            <View style={tw`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700`}>
                {/* Search bar */}
                <View style={tw`flex-row items-center mx-3 mt-3 mb-2`}>
                    <View style={tw`flex-1 flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-3`}>
                        <Icon name="magnify" size={15} color={tw.color('gray-400')} style={tw`mr-2`} />
                        <TextInput
                            style={tw`flex-1 py-2.5 text-gray-800 dark:text-gray-100 text-sm`}
                            placeholder="Cari menu..."
                            placeholderTextColor={tw.color('gray-400')}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={tw`p-1`}>
                                <Icon name="close" size={14} color={tw.color('gray-400')} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={tw`ml-2 h-11 w-11 rounded-xl bg-blue-600 items-center justify-center`}
                        onPress={openScannerPanel}
                    >
                        <Icon name="barcode-scan" size={22} color="white" />
                    </TouchableOpacity>
                </View>
                {/* Category pills */}
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[{ id: null, name: 'Semua' }, ...categories, ...(packages.length > 0 ? [{ id: 'PAKET', name: 'Paket' }] : [])]}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={tw`p-3`}
                    renderItem={({ item }) => {
                        const isActive = item.id === 'PAKET' ? showPaketCategory : (!showPaketCategory && selectedCategory === item.id);
                        return (
                            <TouchableOpacity
                                onPress={() => {
                                    if (item.id === 'PAKET') {
                                        setShowPaketCategory(true);
                                        setSelectedCategory(null);
                                    } else {
                                        setShowPaketCategory(false);
                                        setSelectedCategory(item.id);
                                    }
                                }}
                                style={tw`px-4 py-2 mr-2 rounded-full border ${isActive ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                            >
                                <Text style={tw`font-bold text-[13px] ${isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{item.name}</Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            <FlatList
                data={filteredProducts}
                extraData={cart}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
                numColumns={!settings.showImages ? 1 : (isTablet ? 3 : 2)}
                key={(!settings.showImages ? 'list' : 'grid') + (isTablet ? '-tablet' : '-mobile')}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={tw`p-2 pb-32`}
                renderItem={renderProduct}
            />
        </View>
    );

    const renderCartPane = () => (
        <View style={tw`w-[350px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-none`}>
            <View style={tw`p-4 border-b border-gray-200 dark:border-gray-700 flex-row justify-between items-center`}>
                <Text style={tw`font-black text-lg text-gray-800 dark:text-gray-100`}>Keranjang</Text>
                <View style={tw`flex-row gap-2`}>
                    {pendingSales.length > 0 && (
                        <TouchableOpacity onPress={() => setShowPendingModal(true)} style={tw`p-2 bg-amber-50 rounded-lg`}>
                            <Icon name="clock-outline" size={16} color={tw.color('amber-600')} />
                        </TouchableOpacity>
                    )}
                    {cart.length > 0 && (
                        <TouchableOpacity onPress={clearCart} style={tw`p-2 bg-red-50 rounded-lg`}>
                            <Icon name="delete-outline" size={16} color={tw.color('red-600')} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={cart}
                keyExtractor={(item) => String(item.cartItemId)}
                renderItem={renderCartItem}
                contentContainerStyle={tw`flex-grow`}
                ListEmptyComponent={() => (
                    <View style={tw`flex-1 items-center justify-center p-10`}>
                        <Icon name="cart" size={48} color={tw.color('gray-200')} />
                        <Text style={tw`text-gray-400 dark:text-gray-500 mt-4 text-center font-bold`}>Belum ada barang{'\n'}di keranjang</Text>
                    </View>
                )}
            />

            <View style={tw`p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900`}>
                <View style={tw`flex-row justify-between mb-4 items-center`}>
                    <Text style={tw`font-bold text-gray-500 dark:text-gray-400 uppercase text-xs`}>Total Tagihan</Text>
                    <Text style={tw`font-black text-2xl text-blue-600`}>{formatRp(cartTotal)}</Text>
                </View>
                {settings.enableKitchenPrint && (
                    <TouchableOpacity
                        style={tw`mb-3 py-3 rounded-xl items-center flex-row justify-center border border-orange-300 bg-orange-50 ${isPrintingKitchen || cart.length === 0 ? 'opacity-50' : ''}`}
                        disabled={isPrintingKitchen || cart.length === 0}
                        onPress={handlePrintKitchen}
                    >
                        <Icon name="chef-hat" size={18} color={tw.color('orange-700')} style={tw`mr-2`} />
                        <Text style={tw`font-black text-orange-700`}>{isPrintingKitchen ? 'Mencetak...' : 'Cetak Dapur'}</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={tw`py-4 rounded-xl items-center flex-row justify-center shadow-sm ${cart.length === 0 ? 'bg-gray-300' : 'bg-blue-600'}`}
                    disabled={cart.length === 0}
                    onPress={() => navigation.navigate('Checkout')}
                >
                    <Icon name="cart" size={20} color="white" style={tw`mr-2`} />
                    <Text style={tw`font-bold text-white text-lg`}>Bayar Sekarang</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderMobileCartPanel = () => {
        if (isTablet) return null;

        const emptyBarHeight = 56;

        // Empty cart state — show persistent bottom bar
        if (cartItemCount === 0) {
            return (
                <View style={[tw`bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 absolute bottom-0 left-0 right-0 z-50`, { height: emptyBarHeight }]}>
                    <View style={tw`flex-1 flex-row items-center justify-center px-4`}>
                        <Icon name="cart-outline" size={20} color={tw.color('gray-300')} style={tw`mr-2.5`} />
                        <Text style={tw`text-gray-400 dark:text-gray-500 font-bold text-sm`}>Belum ada barang di keranjang</Text>
                    </View>
                </View>
            );
        }

        const toggleExpand = () => {
            const toValue = mobileCartExpanded ? 0 : 1;
            Animated.spring(cartPanelAnim, {
                toValue,
                useNativeDriver: false,
                friction: 12,
                tension: 60,
            }).start();
            setMobileCartExpanded(!mobileCartExpanded);
        };

        const panelHeight = cartPanelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [collapsedHeight, expandedHeight],
        });

        return (
            <Animated.View style={[tw`bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg absolute bottom-0 left-0 right-0 z-50`, { height: panelHeight }]}>
                {/* Header area — KERANJANG label + chevron (left), pending (right) */}
                <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7} style={tw`flex-row items-center justify-between px-4 pt-2.5 pb-1`}>
                    <View style={tw`flex-row items-center`}>
                        <Icon name="cart" size={16} color={tw.color('blue-600')} style={tw`mr-2`} />
                        <Text style={tw`text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wide`}>Keranjang</Text>
                        <View style={tw`bg-blue-600 ml-2 w-5 h-5 rounded-full items-center justify-center`}>
                            <Text style={tw`text-white font-black text-[10px]`}>{cartItemCount}</Text>
                        </View>
                        <Icon name={mobileCartExpanded ? 'chevron-down' : 'chevron-up'} size={24} color={tw.color('gray-500')} style={tw`ml-1`} />
                    </View>
                    <View style={tw`flex-row items-center`}>
                        {pendingSales.length > 0 && (
                            <TouchableOpacity style={tw`flex-row items-center bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200`} onPress={() => setShowPendingModal(true)}>
                                <Icon name="clock-outline" size={14} color={tw.color('amber-600')} />
                                <Text style={tw`text-amber-700 font-bold text-[11px] ml-1`}>{pendingSales.length}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Summary bar — always visible */}
                <View style={tw`px-4 pb-2 flex-row justify-between items-center`}>
                    <View style={tw`flex-row items-center flex-1`}>
                        <View>
                            <Text style={tw`text-gray-800 dark:text-gray-100 font-black text-base`}>{formatRp(cartTotal)}</Text>
                            <Text style={tw`text-gray-400 text-[10px] font-bold`}>{cartItemCount} item di keranjang</Text>
                        </View>
                    </View>
                    {settings.enableKitchenPrint && (
                        <TouchableOpacity
                            style={tw`mr-2 px-3 py-2.5 rounded-xl flex-row items-center border border-orange-300 bg-orange-50 ${isPrintingKitchen ? 'opacity-50' : ''}`}
                            disabled={isPrintingKitchen}
                            onPress={handlePrintKitchen}
                        >
                            <Icon name="chef-hat" size={16} color={tw.color('orange-700')} />
                            <Text style={tw`text-orange-700 font-black text-xs ml-1`}>{isPrintingKitchen ? '...' : 'Dapur'}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={tw`bg-blue-600 px-5 py-2.5 rounded-xl flex-row items-center`}
                        onPress={() => navigation.navigate('Checkout')}
                    >
                        <Text style={tw`text-white font-bold text-sm mr-1`}>Bayar</Text>
                        <Icon name="chevron-right" size={16} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Expanded cart content */}
                <View style={tw`flex-1 overflow-hidden`}>
                    <View style={tw`flex-row justify-end items-center px-4 pt-1.5 pb-2 border-t border-gray-100 dark:border-gray-700`}>
                        <TouchableOpacity onPress={clearCart} style={tw`flex-row items-center bg-red-50 px-3 py-1.5 rounded-lg border border-red-200`}>
                            <Icon name="delete-outline" size={16} color={tw.color('red-500')} />
                            <Text style={tw`text-red-600 font-bold text-xs ml-1.5`}>Hapus Semua</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={tw`flex-1 px-4`} showsVerticalScrollIndicator={false}>
                        {cart.map((item, idx) => (
                            <View key={item.cartItemId || idx} style={tw`flex-row items-center py-2 ${idx > 0 ? 'border-t border-gray-50 dark:border-gray-700' : ''}`}>
                                <View style={tw`flex-1 mr-2`}>
                                    <TouchableOpacity onPress={() => handleEditCartItem(item)} activeOpacity={0.7}>
                                        <Text style={tw`text-gray-800 dark:text-gray-100 font-bold text-xs`} numberOfLines={1}>{item.name}</Text>
                                        {item.notes ? (
                                            <Text style={tw`text-blue-500 text-[10px] italic`} numberOfLines={1}>{item.notes}</Text>
                                        ) : (
                                            <Text style={tw`text-[10px] text-gray-400 italic`}>Tap untuk add-on / catatan</Text>
                                        )}
                                    </TouchableOpacity>
                                    <Text style={tw`text-blue-600 text-[10px] font-bold mt-0.5`}>{formatRp(item.price * item.quantity)}</Text>
                                </View>
                                <View style={tw`flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700`}>
                                    <TouchableOpacity onPress={() => handleUpdateQuantity(item, item.quantity - 1)} style={tw`px-2 py-1.5`}>
                                        <Icon name="minus" size={12} color={tw.color('gray-600')} />
                                    </TouchableOpacity>
                                    <Text style={tw`px-2 font-black text-gray-800 dark:text-gray-100 text-xs`}>{item.quantity}</Text>
                                    <TouchableOpacity onPress={() => handleUpdateQuantity(item, item.quantity + 1)} style={tw`px-2 py-1.5`}>
                                        <Icon name="plus" size={12} color={tw.color('gray-600')} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </Animated.View>
        );
    };

    // Pending icon when no item in cart (mobile)
    const renderPendingFAB = () => {
        if (pendingSales.length === 0 || cartItemCount > 0 || isTablet) return null;
        // Position above the empty cart bar (56px)
        return (
            <TouchableOpacity
                style={tw`absolute bottom-20 right-4 bg-amber-500 p-4 rounded-full shadow-lg z-50 flex-row items-center`}
                onPress={() => setShowPendingModal(true)}
            >
                <Icon name="clock-outline" size={20} color="white" />
                <Text style={tw`text-white font-bold ml-1 text-xs`}>{pendingSales.length}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={tw`flex-1 bg-white dark:bg-gray-800 flex-row`}>
            {renderProductsPane()}
            {isTablet && renderCartPane()}
            {renderMobileCartPanel()}
            {renderPendingFAB()}

            {/* Add-on / Notes Modal */}
            <Modal visible={addonModalVisible} transparent animationType="fade">
                <View style={tw`flex-1 bg-black/50 justify-center px-4`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl`}>
                        <Text style={tw`font-black text-xl text-gray-800 dark:text-gray-100 mb-1`}>
                            {selectedProductForAddon ? 'Edit Add-on & Catatan' : 'Add-on / Catatan'}
                        </Text>
                        <Text style={tw`text-sm text-gray-500 dark:text-gray-400 mb-4`}>
                            {selectedProductForAddon?.name}
                        </Text>

                        {/* Add-on checkboxes */}
                        {productAddons.length > 0 && (
                            <View style={tw`mb-4`}>
                                {productAddons.map(addon => {
                                    const checked = selectedAddons.includes(addon.id);
                                    return (
                                        <TouchableOpacity
                                            key={addon.id}
                                            style={tw`flex-row items-center py-2.5 border-b border-gray-100 dark:border-gray-700`}
                                            onPress={() => setSelectedAddons(prev =>
                                                checked ? prev.filter(id => id !== addon.id) : [...prev, addon.id]
                                            )}
                                        >
                                            <View style={tw`w-5 h-5 rounded border ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} items-center justify-center mr-3`}>
                                                {checked && <Icon name="check" size={12} color="white" />}
                                            </View>
                                            <Text style={tw`flex-1 font-bold text-gray-800 dark:text-gray-100`}>{addon.name}</Text>
                                            {addon.price > 0 && <Text style={tw`text-blue-600 font-bold text-sm`}>+Rp {addon.price.toLocaleString('id-ID')}</Text>}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        <TextInput
                            style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-5 text-gray-800 dark:text-gray-100`}
                            placeholder="Catatan tambahan (opsional)..."
                            placeholderTextColor={tw.color('gray-400')}
                            value={addonNotes}
                            onChangeText={setAddonNotes}
                        />

                        <View style={tw`flex-row gap-3`}>
                            <TouchableOpacity
                                style={tw`flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl items-center`}
                                onPress={() => { setAddonModalVisible(false); setAddonProductItem(null); setSelectedProductForAddon(null); }}
                            >
                                <Text style={tw`font-bold text-gray-600 dark:text-gray-300`}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={tw`flex-1 bg-blue-600 py-3 rounded-xl items-center`}
                                onPress={handleConfirmCartEdit}
                            >
                                <Text style={tw`font-bold text-white`}>Simpan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Qty Edit Modal */}
            <Modal visible={showQtyModal} transparent animationType="fade">
                <View style={tw`flex-1 bg-black/50 justify-center px-6`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl`}>
                        <Text style={tw`font-black text-lg text-gray-800 dark:text-gray-100 mb-4`}>Ubah Jumlah</Text>
                        <TextInput
                            style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 font-bold text-2xl text-center mb-5`}
                            keyboardType="numeric"
                            value={qtyInput}
                            onChangeText={t => setQtyInput(t.replace(/[^0-9]/g, ''))}
                            autoFocus
                            selectTextOnFocus
                        />
                        <View style={tw`flex-row gap-3`}>
                            <TouchableOpacity
                                style={tw`flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl items-center`}
                                onPress={() => setShowQtyModal(false)}
                            >
                                <Text style={tw`font-bold text-gray-600 dark:text-gray-300`}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={tw`flex-1 bg-blue-600 py-3 rounded-xl items-center`}
                                onPress={() => {
                                    const qty = parseInt(qtyInput || '0', 10);
                                    if (qty > 0 && editingQtyItem) handleUpdateQuantity(editingQtyItem, qty);
                                    setShowQtyModal(false);
                                }}
                            >
                                <Text style={tw`font-bold text-white`}>OK</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Pending Sales Modal */}
            <Modal visible={showPendingModal} animationType="slide" transparent>
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-t-3xl max-h-[70%] p-6`}>
                        <View style={tw`flex-row justify-between items-center mb-5`}>
                            <Text style={tw`text-xl font-bold text-gray-800 dark:text-gray-100`}>Order Meja & Pending</Text>
                            <TouchableOpacity onPress={() => setShowPendingModal(false)} style={tw`p-2 bg-gray-100 dark:bg-gray-700 rounded-full`}>
                                <Icon name="close" size={18} color={tw.color('gray-600')} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={pendingSales}
                            keyExtractor={item => item.id}
                            ListEmptyComponent={() => <Text style={tw`text-center text-gray-400 py-8`}>Belum ada order meja atau pending</Text>}
                            renderItem={({ item }) => {
                                const meta = getPendingMeta(item);
                                const isTableOrder = isTablePendingOrder(item);
                                return (
                                    <View style={tw`flex-row items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-3 border border-gray-100 dark:border-gray-800`}>
                                        <View style={tw`flex-1`}>
                                            <View style={tw`flex-row items-center flex-wrap`}>
                                                <Text style={tw`font-bold text-gray-800 dark:text-gray-100 mr-2`}>{getPendingDisplayName(item)}</Text>
                                                {isTableOrder && (
                                                    <View style={tw`bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mr-1`}>
                                                        <Text style={tw`text-[9px] font-black text-emerald-700 uppercase`}>Order Meja</Text>
                                                    </View>
                                                )}
                                                {item.source === 'server' && (
                                                    <View style={tw`bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full`}>
                                                        <Text style={tw`text-[9px] font-black text-blue-600 uppercase`}>Server</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-1`}>{new Date(item.createdAt).toLocaleString('id-ID')}</Text>
                                            {meta?.orderCode ? (
                                                <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-0.5`}>{meta.orderCode}</Text>
                                            ) : null}
                                            <Text style={tw`text-xs text-blue-600 mt-0.5 font-bold`}>{getPendingItemCount(item)} item</Text>
                                        </View>
                                        <View style={tw`flex-row gap-2`}>
                                            <TouchableOpacity style={tw`p-2 bg-red-50 rounded-lg`} onPress={() => deletePendingSale(item)}>
                                                <Icon name="delete-outline" size={16} color={tw.color('red-500')} />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={tw`bg-blue-600 px-4 py-2 rounded-xl flex-row items-center`} onPress={() => resumePendingSale(item)}>
                                                <Text style={tw`text-white font-bold text-sm`}>Lanjutkan</Text>
                                                <Icon name="chevron-right" size={14} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Barcode Input Modal */}
            <Modal visible={showScanner} animationType="slide" transparent>
                <View style={tw`flex-1 bg-black/60 justify-center items-center px-6`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-2xl w-full p-5 shadow-lg max-w-sm`}>
                        <View style={tw`flex-row justify-between items-center mb-4`}>
                            <Text style={tw`text-lg font-black text-gray-800 dark:text-gray-100`}>Scan Barcode</Text>
                            <TouchableOpacity onPress={() => setShowScanner(false)} style={tw`p-2`}>
                                <Icon name="close" size={20} color={tw.color('gray-500')} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={tw`bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 py-4 rounded-xl items-center flex-row justify-center mb-4`}
                            onPress={handleOpenCamera}
                        >
                            <Icon name="camera" size={22} color={tw.color('blue-600')} style={tw`mr-2`} />
                            <Text style={tw`text-blue-700 dark:text-blue-200 font-black`}>Scan dengan Kamera</Text>
                        </TouchableOpacity>

                        <View style={tw`flex-row items-center mb-3`}>
                            <View style={tw`flex-1 h-px bg-gray-200 dark:bg-gray-700`} />
                            <Text style={tw`px-3 text-[10px] text-gray-400 font-bold uppercase`}>Barcode USB / Manual</Text>
                            <View style={tw`flex-1 h-px bg-gray-200 dark:bg-gray-700`} />
                        </View>

                        <TextInput
                            ref={barcodeInputRef}
                            style={tw`border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-lg font-bold text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 mb-3 text-center tracking-widest`}
                            placeholder="Ketik atau scan barcode"
                            placeholderTextColor={tw.color('gray-400')}
                            value={barcodeInput}
                            onChangeText={setBarcodeInput}
                            returnKeyType="done"
                            onSubmitEditing={() => handleBarcodeSubmit(barcodeInput)}
                        />
                        <TouchableOpacity
                            style={tw`bg-blue-600 py-3 rounded-xl items-center`}
                            onPress={() => handleBarcodeSubmit(barcodeInput)}
                        >
                            <Text style={tw`text-white font-bold text-base`}>Tambahkan Produk</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Full-screen camera keeps scanner controls away from cart actions */}
            <Modal visible={showCamera} animationType="fade" onRequestClose={() => setShowCamera(false)}>
                <View style={tw`flex-1 bg-black`}>
                    <Camera
                        style={tw`flex-1`}
                        cameraType={CameraType.Back}
                        scanBarcode={true}
                        showFrame={true}
                        laserColor="#3b82f6"
                        frameColor="white"
                        onReadCode={handleCameraBarcodeRead}
                    />
                    <View style={tw`absolute top-0 left-0 right-0 pt-10 px-4 pb-4 bg-black/60 flex-row items-center justify-between`}>
                        <View>
                            <Text style={tw`text-white font-black text-lg`}>Scan Barcode</Text>
                            <Text style={tw`text-gray-300 text-xs mt-1`}>Arahkan kamera ke barcode produk</Text>
                        </View>
                        <TouchableOpacity
                            style={tw`w-11 h-11 rounded-full bg-white/20 items-center justify-center`}
                            onPress={() => setShowCamera(false)}
                        >
                            <Icon name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
