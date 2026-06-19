import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Alert, useWindowDimensions, Modal, TextInput, ScrollView, Animated, Vibration, PermissionsAndroid, Platform, RefreshControl } from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { useStore } from '../store/useStore';
import { syncService } from '../services/syncService';
import { getDBConnection } from '../database/db';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function POSScreen({ navigation }: any) {
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

    // Barcode Scanner State (text input based)
    const [showScanner, setShowScanner] = useState(false);
    const [scannedAlert, setScannedAlert] = useState<string | null>(null);
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeInputRef = useRef<TextInput>(null);

    // Mobile cart panel state
    const [mobileCartExpanded, setMobileCartExpanded] = useState(false);
    const { height: screenHeight } = useWindowDimensions();
    const expandedHeight = Math.round(screenHeight * 0.42);
    const collapsedHeight = 72;
    const cartPanelAnim = React.useRef(new Animated.Value(0)).current; // 0 = collapsed, 1 = expanded
    const [refreshing, setRefreshing] = useState(false);

    const cart = useStore((state) => state.cart);
    const settings = useStore((state) => state.settings);
    const addToCart = useStore((state) => state.addToCart);
    const addToCartNewLine = useStore((state) => state.addToCartNewLine);
    const updateCartQuantity = useStore((state) => state.updateCartQuantity);
    const updateCartItemNotes = useStore((state) => state.updateCartItemNotes);
    const updateCartItem = useStore((state) => state.updateCartItem);
    const clearCart = useStore((state) => state.clearCart);
    const cartTotal = useStore((state) => state.cartTotal());
    const cartSubtotal = useStore((state) => state.cartSubtotal());
    const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    const formatRp = (num: number) => 'Rp ' + (Math.round(num) || 0).toLocaleString('id-ID');

    const filteredProducts = (() => {
        if (showPaketCategory) {
            // Show active packages as sellable items
            const pkgs = packages.map(pkg => ({
                ...pkg,
                _isPackage: true,
                isUnlimitedStock: 1,
                stock: 999,
            }));
            return searchQuery.trim()
                ? pkgs.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                : pkgs;
        }
        return searchQuery.trim()
            ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : products;
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
            setProducts(prods);

            // Load pending sales
            const [pendingRes] = await db.executeSql('SELECT * FROM saved_transactions ORDER BY createdAt DESC');
            const pending: any[] = [];
            for (let i = 0; i < pendingRes.rows.length; i++) pending.push(pendingRes.rows.item(i));
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
    }, [selectedCategory]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadData);
        return unsubscribe;
    }, [navigation, loadData]);

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



    const resumePendingSale = async (pending: any) => {
        try {
            const cartData = JSON.parse(pending.cartData);
            clearCart();
            for (const item of cartData) {
                addToCart(item);
                if (item.quantity > 1) {
                    // addToCart adds one at a time, so we need to set the qty
                    // This is handled after initial addToCart
                }
            }
            // Restore quantities
            for (const item of cartData) {
                const cartItemId = `${item.id}-${(item.notes || '').toLowerCase().trim()}`;
                updateCartQuantity(cartItemId, item.quantity);
            }

            // Delete the saved transaction
            const db = await getDBConnection();
            await db.executeSql('DELETE FROM saved_transactions WHERE id = ?', [pending.id]);
            loadData();
            setShowPendingModal(false);
        } catch (e) {
            Alert.alert('Error', 'Gagal melanjutkan penjualan tersimpan.');
        }
    };

    const deletePendingSale = async (id: string) => {
        Alert.alert('Hapus', 'Hapus penjualan yang disimpan ini?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Hapus', style: 'destructive', onPress: async () => {
                    const db = await getDBConnection();
                    await db.executeSql('DELETE FROM saved_transactions WHERE id = ?', [id]);
                    loadData();
                }
            }
        ]);
    };

    const renderProduct = ({ item }: { item: any }) => {
        if (!settings.showImages) {
            return (
                <TouchableOpacity
                    style={tw`flex-row m-2 bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm items-center p-3`}
                    onPress={() => handleProductPress(item)}
                >
                    <View style={tw`flex-1`}>
                        <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-[15px]`} numberOfLines={1}>{item.name}</Text>
                        <Text style={tw`text-blue-600 font-bold mt-1 text-xs`}>{formatRp(item.price)}</Text>
                    </View>
                    <View style={tw`bg-gray-50 dark:bg-gray-900 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700`}>
                        <Text style={tw`text-gray-500 dark:text-gray-400 font-bold text-[10px]`}>Stok: {item.isUnlimitedStock === 1 ? '∞' : item.stock}</Text>
                    </View>
                </TouchableOpacity>
            );
        }
        const numCols = isTablet ? 3 : 2;
        return (
            <View style={{ flex: 1 / numCols, padding: 8 }}>
                <TouchableOpacity
                    style={tw`bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm`}
                    onPress={() => handleProductPress(item)}
                >
                    <View style={tw`h-32 bg-gray-100 dark:bg-gray-800 items-center justify-center`}>
                        {item.imageUrl ? (
                            <Image source={{ uri: item.imageUrl }} style={tw`w-full h-full`} />
                        ) : (
                            <Text style={tw`text-gray-400 dark:text-gray-500 text-xs uppercase tracking-widest font-bold`}>NO IMG</Text>
                        )}
                    </View>
                    <View style={tw`p-3`}>
                        <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-sm`} numberOfLines={1}>{item.name}</Text>
                        <Text style={tw`text-blue-600 font-bold mt-1 text-xs`}>{formatRp(item.price)}</Text>
                        <Text style={tw`text-gray-400 dark:text-gray-500 text-[10px] mt-1`}>Stok: {item.isUnlimitedStock === 1 ? '∞' : item.stock}</Text>
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
                <View style={tw`flex-row items-center mx-3 mt-3 mb-2 bg-gray-100 dark:bg-gray-700 rounded-xl px-3`}>
                    <Icon name="magnify" size={15} color={tw.color('gray-400')} style={tw`mr-2`} />
                    <TextInput
                        style={tw`flex-1 py-2.5 text-gray-800 dark:text-gray-100 text-sm`}
                        placeholder="Cari menu..."
                        placeholderTextColor={tw.color('gray-400')}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="close" size={14} color={tw.color('gray-400')} />
                        </TouchableOpacity>
                    )}
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

    const renderScannerFAB = () => {
        // Position changes based on platform and layout — bottom bar is now always visible
        const bottomPosition = isTablet ? 'bottom-6' : (cartItemCount > 0 ? (mobileCartExpanded ? `bottom-[${expandedHeight + 8}px]` : 'bottom-24') : 'bottom-20');
        return (
            <TouchableOpacity
                style={tw`absolute ${bottomPosition} right-4 bg-blue-600 p-4 rounded-full shadow-lg z-50 items-center justify-center`}
                onPress={() => setShowScanner(true)}
            >
                <Icon name="barcode-scan" size={24} color="white" />
            </TouchableOpacity>
        );
    };

    return (
        <View style={tw`flex-1 bg-white dark:bg-gray-800 flex-row`}>
            {renderProductsPane()}
            {isTablet && renderCartPane()}
            {renderMobileCartPanel()}
            {renderPendingFAB()}
            {renderScannerFAB()}

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
                            <Text style={tw`text-xl font-bold text-gray-800 dark:text-gray-100`}>Penjualan Tersimpan</Text>
                            <TouchableOpacity onPress={() => setShowPendingModal(false)} style={tw`p-2 bg-gray-100 dark:bg-gray-700 rounded-full`}>
                                <Icon name="close" size={18} color={tw.color('gray-600')} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={pendingSales}
                            keyExtractor={item => item.id}
                            ListEmptyComponent={() => <Text style={tw`text-center text-gray-400 py-8`}>Tidak ada penjualan tersimpan</Text>}
                            renderItem={({ item }) => (
                                <View style={tw`flex-row items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-3 border border-gray-100 dark:border-gray-800`}>
                                    <View style={tw`flex-1`}>
                                        <Text style={tw`font-bold text-gray-800 dark:text-gray-100`}>{item.name}</Text>
                                        <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-1`}>{new Date(item.createdAt).toLocaleString('id-ID')}</Text>
                                        <Text style={tw`text-xs text-blue-600 mt-0.5 font-bold`}>{JSON.parse(item.cartData).length} item</Text>
                                    </View>
                                    <View style={tw`flex-row gap-2`}>
                                        <TouchableOpacity style={tw`p-2 bg-red-50 rounded-lg`} onPress={() => deletePendingSale(item.id)}>
                                            <Icon name="delete-outline" size={16} color={tw.color('red-500')} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={tw`bg-blue-600 px-4 py-2 rounded-xl flex-row items-center`} onPress={() => resumePendingSale(item)}>
                                            <Text style={tw`text-white font-bold text-sm`}>Lanjutkan</Text>
                                            <Icon name="chevron-right" size={14} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
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

                        <Text style={tw`text-[10px] text-center text-gray-500 mb-3 mt-2`}>Ketik manual atau scan dengan alat Eksternal</Text>
                                <TextInput
                                    ref={barcodeInputRef}
                                    style={tw`border-2 border-blue-400 rounded-xl px-4 py-3 text-lg font-bold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-gray-700 mb-3 text-center tracking-widest`}
                                    placeholder="Input barcode..."
                                    placeholderTextColor={tw.color('gray-400')}
                                    value={barcodeInput}
                                    onChangeText={setBarcodeInput}
                                    returnKeyType="done"
                                    onSubmitEditing={() => handleBarcodeSubmit(barcodeInput)}
                                />
                                <TouchableOpacity
                                    style={tw`bg-blue-600 py-3 rounded-xl items-center shadow-md`}
                                    onPress={() => handleBarcodeSubmit(barcodeInput)}
                                >
                                    <Text style={tw`text-white font-bold text-base`}>Proses</Text>
                                </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
