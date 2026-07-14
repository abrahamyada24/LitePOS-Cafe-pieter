import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, TextInput, Alert, Modal, ScrollView, Image, Switch
} from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { getDBConnection } from '../database/db';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useStore } from '../store/useStore';
import RNFS from 'react-native-fs';
import { resolveApiAssetUrl } from '../services/api';
import { closeConfiguredPrinter, connectConfiguredPrinter } from '../utils/printerConnection';

const formatRp = (num: number) => 'Rp ' + (Math.round(num) || 0).toLocaleString('id-ID');

export default function ProductListScreen({ navigation }: any) {
    useAppColorScheme(tw);
    const settings = useStore(s => s.settings);
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    // Form
    const [productName, setProductName] = useState('');
    const [productPrice, setProductPrice] = useState('');
    const [productCostPrice, setProductCostPrice] = useState('');
    const [enableCostPrice, setEnableCostPrice] = useState(false);
    const [productStock, setProductStock] = useState('');
    const [productCategoryId, setProductCategoryId] = useState('');
    const [productImageUrl, setProductImageUrl] = useState('');
    const [isUnlimitedStock, setIsUnlimitedStock] = useState(false);
    const [productBarcode, setProductBarcode] = useState('');
    const [productAddons, setProductAddons] = useState<any[]>([]);
    const [newAddonName, setNewAddonName] = useState('');
    const [newAddonPrice, setNewAddonPrice] = useState('');

    const loadData = useCallback(async () => {
        try {
            const db = await getDBConnection();
            const [prodRes] = await db.executeSql(`
                SELECT p.*, c.name as categoryName FROM products p 
                LEFT JOIN categories c ON p.categoryId = c.id ORDER BY p.name
            `);
            const prods: any[] = [];
            for (let i = 0; i < prodRes.rows.length; i++) prods.push(prodRes.rows.item(i));
            setProducts(prods);

            const [catRes] = await db.executeSql('SELECT * FROM categories ORDER BY name');
            const cats: any[] = [];
            for (let i = 0; i < catRes.rows.length; i++) cats.push(catRes.rows.item(i));
            setCategories(cats);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        loadData();
        const unsub = navigation.addListener('focus', loadData);
        return unsub;
    }, [navigation, loadData]);

    const resetForm = () => {
        setEditing(null);
        setProductName(''); setProductPrice(''); setProductCostPrice('');
        setEnableCostPrice(false); setProductStock(''); setProductCategoryId('');
        setProductImageUrl(''); setIsUnlimitedStock(false); setProductBarcode('');
        setProductAddons([]); setNewAddonName(''); setNewAddonPrice('');
    };

    const openAdd = () => { resetForm(); setShowModal(true); };

    const openEdit = async (prod: any) => {
        setEditing(prod);
        setProductName(prod.name);
        setProductPrice(prod.price.toString());
        setProductCostPrice((prod.costPrice || 0).toString());
        setEnableCostPrice(prod.enableCostPrice === 1);
        setProductStock(prod.stock.toString());
        setProductCategoryId(prod.categoryId?.toString() || '');
        setProductImageUrl(prod.imageUrl || '');
        setIsUnlimitedStock(prod.isUnlimitedStock === 1);
        setProductBarcode(prod.barcode || '');
        try {
            const db = await getDBConnection();
            const [aRes] = await db.executeSql('SELECT * FROM product_addons WHERE productId = ? ORDER BY id', [prod.id]);
            const addons: any[] = [];
            for (let i = 0; i < aRes.rows.length; i++) addons.push(aRes.rows.item(i));
            setProductAddons(addons);
        } catch { setProductAddons([]); }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!productName.trim() || !productPrice || !productCategoryId)
            return Alert.alert('Validasi', 'Nama, Harga, dan Kategori wajib diisi.');
            
        const price = parseFloat(productPrice.replace(/[^0-9]/g, '') || '0');
        if (price <= 0) {
            return Alert.alert('Validasi', 'Harga produk tidak boleh 0 (Nol) atau kosong.');
        }

        Alert.alert(
            'Konfirmasi',
            `Anda yakin ingin ${editing ? 'mengubah' : 'menyimpan'} produk ini?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, Simpan',
                    onPress: async () => {
                        try {
                            const db = await getDBConnection();
                            const costPrice = parseFloat(productCostPrice.replace(/[^0-9]/g, '') || '0');
                            const stock = parseInt(productStock || '0', 10);
                            const catId = parseInt(productCategoryId, 10);
                            const img = productImageUrl.trim() || null;
                            const isUnlimited = isUnlimitedStock ? 1 : 0;
                            const enableCost = enableCostPrice ? 1 : 0;
                            const barcode = productBarcode.trim() || null;

                            if (editing) {
                                await db.executeSql(
                                    'UPDATE products SET name=?, price=?, costPrice=?, enableCostPrice=?, stock=?, categoryId=?, imageUrl=?, isUnlimitedStock=?, barcode=?, isSynced=0 WHERE id=?',
                                    [productName, price, costPrice, enableCost, stock, catId, img, isUnlimited, barcode, editing.id]
                                );
                            } else {
                                const [insertRes] = await db.executeSql(
                                    'INSERT INTO products (name, price, costPrice, enableCostPrice, stock, categoryId, imageUrl, isUnlimitedStock, barcode) VALUES (?,?,?,?,?,?,?,?,?)',
                                    [productName, price, costPrice, enableCost, stock, catId, img, isUnlimited, barcode]
                                );
                                // Save buffered addons
                                for (const a of productAddons.filter(x => x.local)) {
                                    await db.executeSql('INSERT INTO product_addons (productId, name, price) VALUES (?, ?, ?)', [insertRes.insertId, a.name, a.price]);
                                }
                            }
                            setShowModal(false);
                            resetForm();
                            loadData();
                        } catch (e) { Alert.alert('Error', 'Gagal menyimpan produk.'); }
                    }
                }
            ]
        );
    };

    const handleDelete = (id: number) => {
        Alert.alert('Konfirmasi', 'Yakin ingin menghapus produk ini?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Hapus', style: 'destructive', onPress: async () => {
                    const db = await getDBConnection();
                    await db.executeSql('DELETE FROM products WHERE id = ?', [id]);
                    loadData();
                }
            }
        ]);
    };

    const handleSaveAddon = async () => {
        if (!newAddonName.trim()) return;
        if (!editing) {
            const local = { id: Date.now(), productId: null, name: newAddonName.trim(), price: parseFloat(newAddonPrice.replace(/[^0-9]/g, '') || '0'), local: true };
            setProductAddons(prev => [...prev, local]);
        } else {
            try {
                const db = await getDBConnection();
                const price = parseFloat(newAddonPrice.replace(/[^0-9]/g, '') || '0');
                await db.executeSql('INSERT INTO product_addons (productId, name, price) VALUES (?, ?, ?)', [editing.id, newAddonName.trim(), price]);
                const [aRes] = await db.executeSql('SELECT * FROM product_addons WHERE productId = ? ORDER BY id', [editing.id]);
                const addons: any[] = [];
                for (let i = 0; i < aRes.rows.length; i++) addons.push(aRes.rows.item(i));
                setProductAddons(addons);
            } catch { Alert.alert('Error', 'Gagal menyimpan add-on.'); }
        }
        setNewAddonName(''); setNewAddonPrice('');
    };

    const handleDeleteAddon = (addonId: number) => {
        Alert.alert('Konfirmasi Hapus', 'Apakah Anda yakin ingin menghapus varian/topping ini?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Hapus',
                style: 'destructive',
                onPress: async () => {
                    if (!editing) {
                        setProductAddons(prev => prev.filter(a => a.id !== addonId));
                    } else {
                        try {
                            const db = await getDBConnection();
                            await db.executeSql('DELETE FROM product_addons WHERE id = ?', [addonId]);
                            setProductAddons(prev => prev.filter(a => a.id !== addonId));
                        } catch { Alert.alert('Error', 'Gagal menghapus add-on.'); }
                    }
                }
            }
        ]);
    };

    const buildBarcodeRawBase64 = (barcodeData: string, productName: string, priceText: string): string => {
        // Build ESC/POS raw bytes for barcode label printing (offline, no internet needed)
        const bytes: number[] = [];

        // ESC @ — Initialize printer
        bytes.push(0x1B, 0x40);

        // ESC a 1 — Center alignment
        bytes.push(0x1B, 0x61, 0x01);

        // Print product name (normal size)
        const nameEncoder = new TextEncoder();
        const nameBytes = nameEncoder.encode(productName.toUpperCase() + '\n');
        bytes.push(...nameBytes);

        // GS w 2 — Set barcode width (module width = 2)
        bytes.push(0x1D, 0x77, 0x02);

        // GS h 60 — Set barcode height (60 dots)
        bytes.push(0x1D, 0x68, 0x3C);

        // GS H 2 — Set HRI (Human Readable Interpretation) position: below barcode
        bytes.push(0x1D, 0x48, 0x02);

        // GS f 0 — Set HRI font to Font A
        bytes.push(0x1D, 0x66, 0x00);

        // GS k 73 n data — Print CODE128 barcode
        // Format: GS k m n d1...dn
        // m = 73 (CODE128), n = length of data
        const barcodeBytes = nameEncoder.encode(barcodeData);
        bytes.push(0x1D, 0x6B, 0x49, barcodeBytes.length + 2);
        // CODE128: start with Code B ({B) for alphanumeric
        bytes.push(0x7B, 0x42); // {B = Code B
        bytes.push(...barcodeBytes);

        // Line feed after barcode
        bytes.push(0x0A, 0x0A);

        // Print price (centered, normal size)
        if (priceText) {
            const priceBytes = nameEncoder.encode(priceText + '\n');
            bytes.push(...priceBytes);
        }

        // Feed and partial cut
        bytes.push(0x0A, 0x0A, 0x0A, 0x0A);

        // Convert to base64
        const uint8 = new Uint8Array(bytes);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return btoa(binary);
    };

    const handlePrintBarcode = async (product: any) => {
        if (!product.barcode) return Alert.alert('Info', 'Produk ini belum memiliki barcode.');
        if (!settings?.printerAddress || !settings?.printerType) return Alert.alert('Info', 'Belum ada printer yang dikonfigurasi.');
        try {
            const printerClass = await connectConfiguredPrinter(settings);

            const priceText = product.price ? `Rp ${product.price.toLocaleString('id-ID')}` : '';
            const base64Data = buildBarcodeRawBase64(product.barcode, product.name, priceText);
            await printerClass.printRaw(base64Data);

            await closeConfiguredPrinter(settings, printerClass);
        } catch (error: any) { 
            Alert.alert('Error', `Gagal mencetak barcode: ${error?.message || error}`); 
        }
    };

    const filtered = searchQuery.trim()
        ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : products;

    return (
        <View style={tw`flex-1 bg-gray-50 dark:bg-gray-900`}>
            <View style={tw`bg-white dark:bg-gray-800 px-4 py-3 flex-row items-center border-b border-gray-200 dark:border-gray-700`}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2 mr-2`}>
                    <Icon name="arrow-left" size={24} color={tw.color('gray-800')} />
                </TouchableOpacity>
                <Text style={tw`text-xl font-black text-gray-800 dark:text-gray-100 flex-1`}>Produk ({products.length})</Text>
                <TouchableOpacity style={tw`bg-blue-600 px-4 py-2 rounded-xl flex-row items-center`} onPress={openAdd}>
                    <Icon name="plus" size={16} color={tw.color('white')} style={tw`mr-1`} />
                    <Text style={tw`font-bold text-white text-sm`}>Tambah</Text>
                </TouchableOpacity>
            </View>

            <View style={tw`bg-white dark:bg-gray-800 px-4 py-2 border-b border-gray-100 dark:border-gray-800`}>
                <View style={tw`flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl px-3`}>
                    <Icon name="magnify" size={14} color={tw.color('gray-400')} style={tw`mr-2`} />
                    <TextInput style={tw`flex-1 py-2.5 text-gray-800 dark:text-gray-100 text-sm`}
                        placeholder="Cari produk..." placeholderTextColor={tw.color('gray-400')}
                        value={searchQuery} onChangeText={setSearchQuery} />
                    {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Icon name="close" size={14} color={tw.color('gray-400')} /></TouchableOpacity>}
                </View>
            </View>

            <FlatList data={filtered} keyExtractor={item => String(item.id)} contentContainerStyle={tw`p-4 pb-10`}
                renderItem={({ item }) => (
                    <TouchableOpacity style={tw`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-3 border border-gray-100 dark:border-gray-800 flex-row justify-between items-center`}
                        onPress={() => openEdit(item)} activeOpacity={0.7}>
                        <View style={tw`flex-1 mr-3`}>
                            <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-base`}>{item.name}</Text>
                            <View style={tw`flex-row items-center mt-1 flex-wrap`}>
                                <Text style={tw`text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-md mr-2`}>{item.categoryName || 'Tanpa Kategori'}</Text>
                                <Text style={tw`text-xs text-gray-500`}>Stok: <Text style={tw`font-bold`}>{item.isUnlimitedStock === 1 ? '∞' : item.stock}</Text></Text>
                            </View>
                            <Text style={tw`font-black text-blue-600 mt-1`}>{formatRp(item.price)}</Text>
                            {item.enableCostPrice === 1 && item.costPrice > 0 && <Text style={tw`text-xs text-gray-400`}>Modal: {formatRp(item.costPrice)}</Text>}
                            {item.barcode ? <Text style={tw`text-xs text-blue-500 mt-1`}>Barcode: {item.barcode}</Text> : null}
                        </View>
                        <View style={tw`flex-row items-center gap-2`}>
                            <TouchableOpacity style={tw`p-2 bg-blue-50 rounded-lg`} onPress={() => handlePrintBarcode(item)}>
                                <Icon name="printer" size={16} color={tw.color('blue-600')} />
                            </TouchableOpacity>
                            <TouchableOpacity style={tw`p-2 bg-red-50 rounded-lg`} onPress={() => handleDelete(item.id)}>
                                <Icon name="delete-outline" size={16} color={tw.color('red-600')} />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
            />

            {/* Product Modal */}
            <Modal visible={showModal} transparent animationType="slide">
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-t-3xl shadow-xl max-h-[90%]`}>
                        <View style={tw`flex-row justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800`}>
                            <Text style={tw`font-black text-xl text-gray-800 dark:text-gray-100`}>{editing ? 'Edit Produk' : 'Produk Baru'}</Text>
                            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} style={tw`p-2 bg-gray-100 dark:bg-gray-700 rounded-full`}>
                                <Icon name="close" size={22} color={tw.color('gray-600')} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`px-6 py-4 pb-8`}>
                            {/* Basic Info */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4`}>
                                <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3`}>Informasi Dasar</Text>
                                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Nama Produk *</Text>
                                <TextInput style={tw`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-3`}
                                    placeholder="Contoh: Nasi Goreng" value={productName} onChangeText={setProductName} />
                                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Barcode (opsional)</Text>
                                <TextInput style={tw`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-3`}
                                    placeholder="Scan atau ketik barcode..." value={productBarcode} onChangeText={setProductBarcode} autoCapitalize="none" />
                                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Foto Produk</Text>
                                <TouchableOpacity style={tw`bg-white dark:bg-gray-800 border border-dashed border-blue-300 rounded-xl py-3 items-center flex-row justify-center`}
                                    onPress={async () => {
                                        const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
                                        if (!result.didCancel && result.assets?.[0]) {
                                            if (result.assets[0].fileSize && result.assets[0].fileSize > 2 * 1024 * 1024) return Alert.alert('Gagal', 'Max 2MB.');
                                            setProductImageUrl(result.assets[0].uri || '');
                                        }
                                    }}>
                                    {productImageUrl ? <Image source={{ uri: resolveApiAssetUrl(productImageUrl, settings.apiBaseUrl) || undefined }} style={tw`w-12 h-12 rounded-lg mr-3`} resizeMode="cover" />
                                        : <Icon name="camera" size={22} color={tw.color('blue-400')} style={tw`mr-2`} />}
                                    <Text style={tw`text-blue-600 font-bold text-sm`}>{productImageUrl ? 'Ganti Gambar' : 'Pilih dari Galeri'}</Text>
                                    {productImageUrl ? <TouchableOpacity onPress={() => setProductImageUrl('')} style={tw`ml-3 p-1`}><Icon name="close" size={14} color={tw.color('red-400')} /></TouchableOpacity> : null}
                                </TouchableOpacity>
                            </View>

                            {/* Price */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4`}>
                                <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3`}>Harga & HPP</Text>
                                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Harga Jual *</Text>
                                <View style={tw`flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-3 overflow-hidden`}>
                                    <View style={tw`bg-blue-50 px-3 py-3 border-r border-gray-200`}><Text style={tw`font-black text-blue-600 text-sm`}>Rp</Text></View>
                                    <TextInput style={tw`flex-1 px-4 py-3 text-gray-800 dark:text-gray-100 font-bold`} keyboardType="numeric" placeholder="15.000"
                                        value={productPrice ? parseInt(productPrice).toLocaleString('id-ID') : ''} onChangeText={t => setProductPrice(t.replace(/[^0-9]/g, ''))} />
                                </View>
                                <View style={tw`flex-row items-center justify-between mb-1`}>
                                    <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300`}>Harga Beli / HPP</Text>
                                    <View style={tw`flex-row items-center`}>
                                        <Text style={tw`text-xs text-gray-400 mr-2`}>{enableCostPrice ? 'Aktif' : 'Off'}</Text>
                                        <Switch value={enableCostPrice} onValueChange={setEnableCostPrice}
                                            trackColor={{ false: '#d1d5db', true: '#93c5fd' }} thumbColor={enableCostPrice ? '#2563eb' : '#f3f4f6'} />
                                    </View>
                                </View>
                                <View style={tw`flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden ${!enableCostPrice ? 'opacity-40' : ''}`}>
                                    <View style={tw`bg-gray-50 px-3 py-3 border-r border-gray-200`}><Text style={tw`font-black text-gray-500 text-sm`}>Rp</Text></View>
                                    <TextInput style={tw`flex-1 px-4 py-3 text-gray-800 dark:text-gray-100 font-bold`} keyboardType="numeric"
                                        placeholder={enableCostPrice ? '10.000' : 'Off'}
                                        value={enableCostPrice ? (productCostPrice ? parseInt(productCostPrice).toLocaleString('id-ID') : '') : ''}
                                        onChangeText={t => setProductCostPrice(t.replace(/[^0-9]/g, ''))} editable={enableCostPrice} />
                                </View>
                                {enableCostPrice && productPrice && productCostPrice && (
                                    <View style={tw`flex-row items-center justify-between mt-2 bg-green-50 rounded-lg px-3 py-2`}>
                                        <Text style={tw`text-xs text-green-700`}>Margin:</Text>
                                        <Text style={tw`text-sm font-black text-green-700`}>{formatRp(parseFloat(productPrice) - parseFloat(productCostPrice))} ({Math.round((parseFloat(productPrice) - parseFloat(productCostPrice)) / parseFloat(productPrice) * 100)}%)</Text>
                                    </View>
                                )}
                            </View>

                            {/* Stock */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4`}>
                                <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3`}>Stok</Text>
                                <View style={tw`flex-row items-center gap-2`}>
                                    <View style={tw`flex-1`}>
                                        <TextInput style={tw`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 ${isUnlimitedStock ? 'opacity-40' : ''}`}
                                            keyboardType="numeric" placeholder={isUnlimitedStock ? '∞ Unlimited' : '50'}
                                            value={productStock} onChangeText={t => setProductStock(t.replace(/[^0-9-]/g, ''))} editable={!isUnlimitedStock} />
                                    </View>
                                    <TouchableOpacity style={tw`flex-row items-center p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800`}
                                        onPress={() => { if (!isUnlimitedStock) setProductStock(''); setIsUnlimitedStock(!isUnlimitedStock); }}>
                                        <View style={tw`w-5 h-5 rounded border ${isUnlimitedStock ? 'bg-blue-600 border-blue-600' : 'border-gray-300'} items-center justify-center mr-2`}>
                                            {isUnlimitedStock && <Icon name="check" size={14} color="white" />}
                                        </View>
                                        <Text style={tw`text-xs text-gray-600 dark:text-gray-300 font-bold`}>∞</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Category */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4`}>
                                <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3`}>Kategori *</Text>
                                <View style={tw`flex-row flex-wrap`}>
                                    {categories.map(cat => (
                                        <TouchableOpacity key={cat.id}
                                            style={tw`px-4 py-2 border rounded-full mr-2 mb-2 ${productCategoryId === cat.id.toString() ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
                                            onPress={() => setProductCategoryId(cat.id.toString())}>
                                            <Text style={tw`text-sm ${productCategoryId === cat.id.toString() ? 'text-white font-bold' : 'text-gray-600'}`}>{cat.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Addons */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-5`}>
                                <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1`}>Add-on / Pilihan Tambahan</Text>
                                <Text style={tw`text-xs text-gray-400 mb-3`}>Muncul saat item dipilih di kasir.</Text>
                                {productAddons.map(addon => (
                                    <View key={addon.id} style={tw`flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 mb-2`}>
                                        <View style={tw`flex-1`}>
                                            <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-sm`}>{addon.name}</Text>
                                            {addon.price > 0 && <Text style={tw`text-xs text-blue-600`}>+{formatRp(addon.price)}</Text>}
                                        </View>
                                        <TouchableOpacity onPress={() => handleDeleteAddon(addon.id)} style={tw`p-1.5 bg-red-50 rounded-lg`}>
                                            <Icon name="delete-outline" size={14} color={tw.color('red-500')} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <View style={tw`flex-row items-center gap-2 mt-1`}>
                                    <TextInput style={tw`flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 text-sm`}
                                        placeholder="Nama (mis: Extra Keju)" value={newAddonName} onChangeText={setNewAddonName} />
                                    <TextInput style={tw`w-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-100 text-sm`}
                                        placeholder="+Harga" keyboardType="numeric" value={newAddonPrice} onChangeText={t => setNewAddonPrice(t.replace(/[^0-9]/g, ''))} />
                                    <TouchableOpacity onPress={handleSaveAddon} style={tw`bg-blue-600 p-2.5 rounded-xl`}>
                                        <Icon name="plus" size={18} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity style={tw`bg-gray-900 py-4 rounded-xl items-center flex-row justify-center mb-4`} onPress={handleSave}>
                                <Icon name="content-save" size={18} color="white" style={tw`mr-2`} />
                                <Text style={tw`font-bold text-white text-lg`}>Simpan Produk</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
