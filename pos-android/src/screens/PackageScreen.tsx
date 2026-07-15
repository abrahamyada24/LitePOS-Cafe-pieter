import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, TextInput, Alert, Modal, ScrollView, Switch
} from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { getDBConnection } from '../database/db';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const formatRp = (num: number) => 'Rp ' + (Math.round(num) || 0).toLocaleString('id-ID');

export default function PackageScreen({ navigation }: any) {
    useAppColorScheme(tw);
    const [packages, setPackages] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form
    const [pkgName, setPkgName] = useState('');
    const [pkgDesc, setPkgDesc] = useState('');
    const [pkgPrice, setPkgPrice] = useState('');
    const [pkgActive, setPkgActive] = useState(true);
    const [selectedItems, setSelectedItems] = useState<{ productId: number; name: string; price: number; quantity: number }[]>([]);

    // Product picker
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    const loadData = useCallback(async () => {
        try {
            const db = await getDBConnection();

            // Load all packages with item counts and item details
            const [pkgRes] = await db.executeSql(`
                SELECT p.*, 
                    (SELECT COUNT(*) FROM package_items pi WHERE pi.packageId = p.id) as itemCount,
                    (SELECT SUM(pi.quantity) FROM package_items pi WHERE pi.packageId = p.id) as totalQty
                FROM packages p ORDER BY p.createdAt DESC
            `);
            const pkgArr: any[] = [];
            for (let i = 0; i < pkgRes.rows.length; i++) {
                const pkg = pkgRes.rows.item(i);
                // Load items for each package
                const [itemRes] = await db.executeSql(`
                    SELECT pi.*, pr.name as productName, pr.price as productPrice
                    FROM package_items pi
                    LEFT JOIN products pr ON pi.productId = pr.id
                    WHERE pi.packageId = ?
                `, [pkg.id]);
                const items: any[] = [];
                for (let j = 0; j < itemRes.rows.length; j++) items.push(itemRes.rows.item(j));
                pkg.items = items;
                pkgArr.push(pkg);
            }
            setPackages(pkgArr);

            // Load products
            const [prodRes] = await db.executeSql('SELECT * FROM products ORDER BY name');
            const prodArr: any[] = [];
            for (let i = 0; i < prodRes.rows.length; i++) prodArr.push(prodRes.rows.item(i));
            setProducts(prodArr);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        loadData();
        const unsub = navigation.addListener('focus', loadData);
        return unsub;
    }, [navigation, loadData]);

    const resetForm = () => {
        setEditing(null);
        setPkgName('');
        setPkgDesc('');
        setPkgPrice('');
        setPkgActive(true);
        setSelectedItems([]);
    };

    const openAdd = () => {
        resetForm();
        setShowModal(true);
    };

    const openEdit = async (pkg: any) => {
        setEditing(pkg);
        setPkgName(pkg.name || '');
        setPkgDesc(pkg.description || '');
        setPkgPrice((pkg.price || 0).toString());
        setPkgActive(pkg.isActive === 1);
        // Load items
        const items = (pkg.items || []).map((item: any) => ({
            productId: item.productId,
            name: item.productName || 'Produk dihapus',
            price: item.productPrice || 0,
            quantity: item.quantity || 1,
        }));
        setSelectedItems(items);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!pkgName.trim()) return Alert.alert('Validasi', 'Nama paket wajib diisi.');
        const price = parseFloat(pkgPrice.replace(/[^0-9]/g, '') || '0');
        if (price <= 0) return Alert.alert('Validasi', 'Harga paket harus lebih dari 0.');
        if (selectedItems.length === 0) return Alert.alert('Validasi', 'Tambahkan minimal 1 produk ke paket.');

        try {
            const db = await getDBConnection();
            let packageId: number;

            if (editing) {
                await db.executeSql(
                    'UPDATE packages SET name = ?, description = ?, price = ?, isActive = ?, isSynced = 0 WHERE id = ?',
                    [pkgName.trim(), pkgDesc.trim(), price, pkgActive ? 1 : 0, editing.id]
                );
                packageId = editing.id;
                // Remove old items
                await db.executeSql('DELETE FROM package_items WHERE packageId = ?', [packageId]);
            } else {
                const [insertRes] = await db.executeSql(
                    'INSERT INTO packages (name, description, price, isActive, createdAt) VALUES (?, ?, ?, ?, ?)',
                    [pkgName.trim(), pkgDesc.trim(), price, pkgActive ? 1 : 0, new Date().toISOString()]
                );
                packageId = insertRes.insertId;
            }

            // Insert items
            for (const item of selectedItems) {
                await db.executeSql(
                    'INSERT INTO package_items (packageId, productId, quantity) VALUES (?, ?, ?)',
                    [packageId, item.productId, item.quantity]
                );
            }

            setShowModal(false);
            resetForm();
            loadData();
        } catch (e) {
            Alert.alert('Error', 'Gagal menyimpan paket.');
            console.error(e);
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert('Hapus Paket', 'Yakin ingin menghapus paket ini?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Hapus', style: 'destructive', onPress: async () => {
                    try {
                        const db = await getDBConnection();
                        await db.executeSql('DELETE FROM package_items WHERE packageId = ?', [id]);
                        await db.executeSql('DELETE FROM packages WHERE id = ?', [id]);
                        loadData();
                    } catch (e) { Alert.alert('Error', 'Gagal menghapus paket.'); }
                }
            }
        ]);
    };

    const addProductToPackage = (product: any) => {
        const exists = selectedItems.find(i => i.productId === product.id);
        if (exists) {
            setSelectedItems(prev => prev.map(i =>
                i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setSelectedItems(prev => [...prev, {
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
            }]);
        }
        setShowProductPicker(false);
        setProductSearch('');
    };

    const updateItemQty = (productId: number, delta: number) => {
        setSelectedItems(prev => {
            const updated = prev.map(i => {
                if (i.productId === productId) {
                    const newQty = i.quantity + delta;
                    return newQty > 0 ? { ...i, quantity: newQty } : i;
                }
                return i;
            });
            return delta < 0 ? updated.filter(i => i.quantity > 0) : updated;
        });
    };

    const removeItem = (productId: number) => {
        setSelectedItems(prev => prev.filter(i => i.productId !== productId));
    };

    const totalItemsValue = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const filteredProducts = productSearch.trim()
        ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
        : products;

    const filteredPackages = searchQuery.trim()
        ? packages.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : packages;

    return (
        <View style={tw`flex-1 bg-gray-50 dark:bg-gray-900`}>
            {/* Header */}
            <View style={tw`bg-white dark:bg-gray-800 px-4 py-3 flex-row items-center border-b border-gray-200 dark:border-gray-700`}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2 mr-2`}>
                    <Icon name="arrow-left" size={24} color={tw.color('gray-800')} />
                </TouchableOpacity>
                <View style={tw`flex-1`}>
                    <Text style={tw`text-xl font-black text-gray-800 dark:text-gray-100`}>Paket Bundling</Text>
                    <Text style={tw`text-xs text-gray-500 dark:text-gray-400`}>{packages.length} paket</Text>
                </View>
                <TouchableOpacity
                    style={tw`bg-blue-600 px-4 py-2 rounded-xl flex-row items-center`}
                    onPress={openAdd}
                >
                    <Icon name="plus" size={16} color={tw.color('white')} style={tw`mr-1`} />
                    <Text style={tw`font-bold text-white text-sm`}>Buat Paket</Text>
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={tw`bg-white dark:bg-gray-800 px-4 py-2 border-b border-gray-100 dark:border-gray-800`}>
                <View style={tw`flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl px-3`}>
                    <Icon name="magnify" size={14} color={tw.color('gray-400')} style={tw`mr-2`} />
                    <TextInput
                        style={tw`flex-1 py-2.5 text-gray-800 dark:text-gray-100 text-sm`}
                        placeholder="Cari paket..."
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
            </View>

            {/* Package List */}
            <FlatList
                data={filteredPackages}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={tw`p-4 pb-10`}
                ListEmptyComponent={() => (
                    <View style={tw`items-center py-20`}>
                        <Icon name="package-variant-closed" size={48} color={tw.color('gray-300')} />
                        <Text style={tw`text-gray-400 font-bold mt-4`}>Belum ada paket</Text>
                        <Text style={tw`text-gray-400 text-xs mt-1`}>Buat paket bundling untuk event tertentu</Text>
                        <TouchableOpacity style={tw`mt-4 bg-blue-600 px-5 py-2.5 rounded-xl`} onPress={openAdd}>
                            <Text style={tw`font-bold text-white`}>+ Buat Paket Baru</Text>
                        </TouchableOpacity>
                    </View>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={tw`bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-gray-800 shadow-sm`}
                        onPress={() => openEdit(item)}
                        activeOpacity={0.7}
                    >
                        <View style={tw`flex-row items-start justify-between mb-2`}>
                            <View style={tw`flex-1 mr-3`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Text style={tw`font-black text-gray-800 dark:text-gray-100 text-base mr-2`}>{item.name}</Text>
                                    <View style={tw`px-2 py-0.5 rounded-full ${item.isActive ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                        <Text style={tw`text-[10px] font-black ${item.isActive ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500'}`}>
                                            {item.isActive ? 'Aktif' : 'Nonaktif'}
                                        </Text>
                                    </View>
                                </View>
                                {item.description ? (
                                    <Text style={tw`text-gray-500 dark:text-gray-400 text-xs mb-2`} numberOfLines={2}>{item.description}</Text>
                                ) : null}
                                <Text style={tw`font-black text-blue-600 text-lg`}>{formatRp(item.price)}</Text>
                            </View>
                            <TouchableOpacity style={tw`p-2 bg-red-50 rounded-lg`} onPress={() => handleDelete(item.id)}>
                                <Icon name="delete-outline" size={16} color={tw.color('red-500')} />
                            </TouchableOpacity>
                        </View>

                        {/* Items preview */}
                        {(item.items || []).length > 0 && (
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-3 mt-1`}>
                                <Text style={tw`text-[10px] font-black text-gray-400 uppercase mb-2`}>Isi Paket ({item.itemCount || 0} produk)</Text>
                                {(item.items || []).slice(0, 4).map((pi: any, idx: number) => (
                                    <View key={idx} style={tw`flex-row items-center justify-between ${idx > 0 ? 'mt-1' : ''}`}>
                                        <Text style={tw`text-xs text-gray-700 dark:text-gray-300 flex-1`} numberOfLines={1}>
                                            {pi.productName || 'Produk dihapus'}
                                        </Text>
                                        <Text style={tw`text-xs font-bold text-gray-500 ml-2`}>x{pi.quantity}</Text>
                                    </View>
                                ))}
                                {(item.items || []).length > 4 && (
                                    <Text style={tw`text-xs text-gray-400 mt-1`}>+{item.items.length - 4} produk lainnya</Text>
                                )}
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            />

            {/* Create/Edit Modal */}
            <Modal visible={showModal} transparent animationType="slide">
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-t-3xl shadow-xl max-h-[92%]`}>
                        {/* Header */}
                        <View style={tw`flex-row justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800`}>
                            <Text style={tw`font-black text-xl text-gray-800 dark:text-gray-100`}>
                                {editing ? 'Edit Paket' : 'Paket Baru'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} style={tw`p-2 bg-gray-100 dark:bg-gray-700 rounded-full`}>
                                <Icon name="close" size={20} color={tw.color('gray-600')} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={tw`px-6 py-4 pb-8`} keyboardShouldPersistTaps="handled">
                            {/* Name */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4`}>
                                <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3`}>Informasi Paket</Text>

                                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Nama Paket <Text style={tw`text-red-400`}>*</Text></Text>
                                <TextInput
                                    style={tw`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-3`}
                                    placeholder="Contoh: Paket Arisan Hemat"
                                    placeholderTextColor={tw.color('gray-400')}
                                    value={pkgName}
                                    onChangeText={setPkgName}
                                />

                                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Deskripsi</Text>
                                <TextInput
                                    style={tw`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-3`}
                                    placeholder="Deskripsi paket / event..."
                                    placeholderTextColor={tw.color('gray-400')}
                                    multiline
                                    value={pkgDesc}
                                    onChangeText={setPkgDesc}
                                />

                                <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Harga Paket <Text style={tw`text-red-400`}>*</Text></Text>
                                <View style={tw`flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden`}>
                                    <View style={tw`bg-blue-100 px-3 py-3 border-r border-gray-200 dark:border-gray-700`}>
                                        <Text style={tw`font-black text-blue-700 text-sm`}>Rp</Text>
                                    </View>
                                    <TextInput
                                        style={tw`flex-1 px-4 py-3 text-gray-800 dark:text-gray-100 font-bold`}
                                        keyboardType="numeric"
                                        placeholder="50.000"
                                        placeholderTextColor={tw.color('gray-400')}
                                        value={pkgPrice ? parseInt(pkgPrice).toLocaleString('id-ID') : ''}
                                        onChangeText={t => setPkgPrice(t.replace(/[^0-9]/g, ''))}
                                    />
                                </View>

                                {/* Savings indicator */}
                                {pkgPrice && totalItemsValue > 0 && (
                                    <View style={tw`mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 flex-row justify-between items-center`}>
                                        <Text style={tw`text-xs text-blue-700 dark:text-blue-300`}>Hemat dari harga satuan:</Text>
                                        <Text style={tw`text-sm font-black text-blue-700 dark:text-blue-300`}>
                                            {formatRp(totalItemsValue - parseFloat(pkgPrice || '0'))}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Active toggle */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-4 flex-row items-center justify-between`}>
                                <View style={tw`flex-1 mr-4`}>
                                    <Text style={tw`text-sm font-bold text-gray-800 dark:text-gray-100`}>Status Aktif</Text>
                                    <Text style={tw`text-xs text-gray-500 dark:text-gray-400`}>Paket nonaktif tidak muncul di kasir</Text>
                                </View>
                                <Switch
                                    value={pkgActive}
                                    onValueChange={setPkgActive}
                                    trackColor={{ false: '#d1d5db', true: '#bef264' }}
                                    thumbColor={pkgActive ? '#65a30d' : '#f3f4f6'}
                                />
                            </View>

                            {/* Selected Items */}
                            <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-5`}>
                                <View style={tw`flex-row items-center justify-between mb-3`}>
                                    <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-widest`}>
                                        Produk dalam Paket ({selectedItems.length})
                                    </Text>
                                    <TouchableOpacity
                                        style={tw`bg-blue-600 px-3 py-1.5 rounded-lg flex-row items-center`}
                                        onPress={() => setShowProductPicker(true)}
                                    >
                                        <Icon name="plus" size={14} color={tw.color('white')} style={tw`mr-1`} />
                                        <Text style={tw`font-bold text-white text-xs`}>Tambah</Text>
                                    </TouchableOpacity>
                                </View>

                                {selectedItems.length === 0 ? (
                                    <TouchableOpacity
                                        style={tw`border border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-8 items-center`}
                                        onPress={() => setShowProductPicker(true)}
                                    >
                                        <Icon name="package-variant" size={24} color={tw.color('gray-400')} />
                                        <Text style={tw`text-gray-400 font-bold mt-2 text-sm`}>Tap untuk tambah produk</Text>
                                    </TouchableOpacity>
                                ) : (
                                    selectedItems.map((item, idx) => (
                                        <View
                                            key={item.productId}
                                            style={tw`flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 ${idx > 0 ? 'mt-2' : ''}`}
                                        >
                                            <View style={tw`flex-1 mr-2`}>
                                                <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-sm`} numberOfLines={1}>{item.name}</Text>
                                                <Text style={tw`text-xs text-gray-500`}>{formatRp(item.price)} /pcs</Text>
                                            </View>
                                            {/* Qty controls */}
                                            <View style={tw`flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-lg`}>
                                                <TouchableOpacity
                                                    style={tw`p-2`}
                                                    onPress={() => item.quantity <= 1 ? removeItem(item.productId) : updateItemQty(item.productId, -1)}
                                                >
                                                    {item.quantity <= 1 ? (
                                                        <Icon name="delete-outline" size={14} color={tw.color('red-500')} />
                                                    ) : (
                                                        <Icon name="minus" size={14} color={tw.color('gray-600')} />
                                                    )}
                                                </TouchableOpacity>
                                                <Text style={tw`font-black text-gray-800 dark:text-gray-100 text-sm px-2 min-w-[24px] text-center`}>{item.quantity}</Text>
                                                <TouchableOpacity style={tw`p-2`} onPress={() => updateItemQty(item.productId, 1)}>
                                                    <Icon name="plus" size={14} color={tw.color('gray-600')} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}

                                {selectedItems.length > 0 && (
                                    <View style={tw`mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex-row justify-between`}>
                                        <Text style={tw`text-xs font-bold text-gray-500`}>Total harga satuan:</Text>
                                        <Text style={tw`text-sm font-black text-gray-700 dark:text-gray-300`}>{formatRp(totalItemsValue)}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Save */}
                            <TouchableOpacity
                                style={tw`bg-gray-900 py-4 rounded-2xl items-center flex-row justify-center mb-4`}
                                onPress={handleSave}
                            >
                                <Icon name="content-save" size={18} color="white" style={tw`mr-2`} />
                                <Text style={tw`font-bold text-white text-lg`}>Simpan Paket</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Product Picker Modal */}
            <Modal visible={showProductPicker} transparent animationType="slide">
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-t-3xl shadow-xl max-h-[70%]`}>
                        <View style={tw`flex-row justify-between items-center px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800`}>
                            <Text style={tw`font-black text-lg text-gray-800 dark:text-gray-100`}>Pilih Produk</Text>
                            <TouchableOpacity onPress={() => { setShowProductPicker(false); setProductSearch(''); }} style={tw`p-2 bg-gray-100 dark:bg-gray-700 rounded-full`}>
                                <Icon name="close" size={20} color={tw.color('gray-600')} />
                            </TouchableOpacity>
                        </View>

                        {/* Search */}
                        <View style={tw`px-6 py-2`}>
                            <View style={tw`flex-row items-center bg-gray-50 dark:bg-gray-900 rounded-xl px-3`}>
                                <Icon name="magnify" size={14} color={tw.color('gray-400')} style={tw`mr-2`} />
                                <TextInput
                                    style={tw`flex-1 py-2.5 text-gray-800 dark:text-gray-100 text-sm`}
                                    placeholder="Cari produk..."
                                    placeholderTextColor={tw.color('gray-400')}
                                    value={productSearch}
                                    onChangeText={setProductSearch}
                                    autoFocus
                                />
                            </View>
                        </View>

                        <FlatList
                            data={filteredProducts}
                            keyExtractor={item => String(item.id)}
                            contentContainerStyle={tw`px-6 pb-8`}
                            ListEmptyComponent={() => (
                                <View style={tw`items-center py-10`}>
                                    <Text style={tw`text-gray-400 font-bold`}>Tidak ada produk</Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const isSelected = selectedItems.some(si => si.productId === item.id);
                                return (
                                    <TouchableOpacity
                                        style={tw`flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800`}
                                        onPress={() => addProductToPackage(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={tw`w-8 h-8 rounded-lg ${isSelected ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-700'} items-center justify-center mr-3`}>
                                            {isSelected ? (
                                                <Icon name="check" size={16} color={tw.color('white')} />
                                            ) : (
                                                <Icon name="package-variant" size={14} color={tw.color('gray-400')} />
                                            )}
                                        </View>
                                        <View style={tw`flex-1`}>
                                            <Text style={tw`font-bold text-gray-800 dark:text-gray-100`}>{item.name}</Text>
                                            <Text style={tw`text-xs text-gray-500`}>{formatRp(item.price)}</Text>
                                        </View>
                                        {isSelected && (
                                            <View style={tw`bg-blue-100 px-2 py-1 rounded-full`}>
                                                <Text style={tw`text-xs font-black text-blue-700`}>
                                                    x{selectedItems.find(si => si.productId === item.id)?.quantity || 0}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
