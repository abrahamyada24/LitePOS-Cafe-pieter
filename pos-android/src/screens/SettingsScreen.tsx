import React, { useEffect, useState } from 'react';
import {
    Alert, PermissionsAndroid, Platform, View, Text, TouchableOpacity,
    ScrollView, TextInput, Switch, Image, LayoutAnimation, UIManager, Linking
} from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { launchImageLibrary } from 'react-native-image-picker';
import { getDBConnection } from '../database/db';
import { useStore } from '../store/useStore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// @ts-ignore - Package has type definition issues
import * as PrinterModule from 'react-native-thermal-receipt-printer-image-qr';
const { BLEPrinter, USBPrinter } = PrinterModule as any;
import RNFS from 'react-native-fs';
import { pick, types } from '@react-native-documents/picker';
import { requestPrinterPermissions } from '../utils/permissions';
import { RECEIPT_LOGO_BASE64 } from '../assets/receiptLogoBase64';
import { API_URL } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Section Menu Item ────────────────────────────────────────────────────────
function SectionItem({ icon, iconColor, label, sublabel, isOpen, onPress, children }: any) {
    return (
        <View style={tw`bg-white dark:bg-gray-800 mb-2 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800`}>
            <TouchableOpacity
                style={tw`flex-row items-center px-5 py-4`}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <View style={tw`w-10 h-10 bg-gray-50 dark:bg-gray-700 rounded-xl items-center justify-center mr-4`}>
                    <Icon name={icon} size={20} color={iconColor || tw.color('gray-600')} />
                </View>
                <View style={tw`flex-1`}>
                    <Text style={tw`font-bold text-gray-800 dark:text-gray-100 text-base`}>{label}</Text>
                    {sublabel ? <Text style={tw`text-gray-500 dark:text-gray-400 text-xs mt-0.5`}>{sublabel}</Text> : null}
                </View>
                {isOpen
                    ? <Icon name="chevron-down" size={18} color={tw.color('gray-400')} />
                    : <Icon name="chevron-right" size={18} color={tw.color('gray-400')} />
                }
            </TouchableOpacity>
            {isOpen && (
                <View style={tw`px-5 pb-5 border-t border-gray-100 dark:border-gray-800`}>
                    {children}
                </View>
            )}
        </View>
    );
}

export default function SettingsScreen({ navigation }: any) {
    const { settings, setSettings } = useStore();
    const [storeName, setStoreName] = useState<string>(settings?.storeName || 'LitePOS');
    const [storeAddress, setStoreAddress] = useState<string>(settings?.storeAddress || '');
    const [storePhone, setStorePhone] = useState<string>(settings?.storePhone || '');
    const [showImages, setShowImages] = useState<boolean>(settings?.showImages ?? true);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(settings?.theme === 'dark');
    const [storeLogo, setStoreLogo] = useState<string | null>(settings?.storeLogo || null);
    const [enablePreOrder, setEnablePreOrder] = useState<boolean>(settings?.enablePreOrder ?? false);
    const [enableShift, setEnableShift] = useState<boolean>(settings?.enableShift ?? true);
    const [enableDineTable, setEnableDineTable] = useState<boolean>(settings?.enableDineTable ?? false);
    const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(settings?.allowNegativeStock ?? false);
    const [showLogoOnReceipt, setShowLogoOnReceipt] = useState<boolean>(settings?.showLogoOnReceipt ?? true);
    const [receiptFooter, setReceiptFooter] = useState<string>(settings?.receiptFooter || '');
    const [loyaltyActive, setLoyaltyActive] = useState<boolean>(settings?.loyalty_active ?? false);
    const [loyaltyMultiplier, setLoyaltyMultiplier] = useState<string>(String(settings?.loyalty_multiplier || '1'));
    const [loyaltyMultiplierAmount, setLoyaltyMultiplierAmount] = useState<string>(String(settings?.loyalty_multiplier_amount || '1000'));
    const [loyaltyPointValue, setLoyaltyPointValue] = useState<string>(String(settings?.loyalty_point_value || '0'));
    const [loyaltyMinPoints, setLoyaltyMinPoints] = useState<string>(String(settings?.loyalty_min_points || '0'));
    const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(settings?.google_sheet_url || '');
    const [, , setColorScheme] = useAppColorScheme(tw);

    // Printer state
    const [bleDevices, setBleDevices] = useState<any[]>([]);
    const [usbDevices, setUsbDevices] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [connectedPrinter, setConnectedPrinter] = useState<string | null>(null);
    const [printerType, setPrinterType] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'BLE' | 'USB'>('BLE');

    // Accordion state
    const [openSection, setOpenSection] = useState<string | null>(null);

    useEffect(() => { loadSettingsFromDB(); }, []);

    const toggleSection = (key: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenSection(openSection === key ? null : key);
    };

    const loadSettingsFromDB = async () => {
        try {
            const db = await getDBConnection();
            const [results] = await db.executeSql('SELECT * FROM settings');
            const rawSettings: any = {};
            for (let i = 0; i < results.rows.length; i++) {
                const item = results.rows.item(i);
                rawSettings[item.key] = item.value;
            }
            const finalSettings = {
                ...settings,
                storeName: rawSettings.storeName || 'LitePOS',
                storeAddress: rawSettings.storeAddress || '',
                storePhone: rawSettings.storePhone || '',
                storeLogo: rawSettings.storeLogo || null,
                enablePreOrder: rawSettings.enablePreOrder === 'true',
                enableDineTable: rawSettings.enableDineTable === 'true',
                enableShift: rawSettings.enableShift === undefined ? true : rawSettings.enableShift === 'true',
                showImages: rawSettings.showImages === 'true',
                printerAddress: rawSettings.printerAddress || null,
                printerType: rawSettings.printerType || null,
                theme: rawSettings.theme || 'light',
                allowNegativeStock: rawSettings.allowNegativeStock === 'true',
                showLogoOnReceipt: rawSettings.showLogoOnReceipt === undefined ? true : rawSettings.showLogoOnReceipt === 'true',
                receiptFooter: rawSettings.receiptFooter || '',
                loyalty_active: rawSettings.loyalty_active === 'true',
                loyalty_multiplier: Number(rawSettings.loyalty_multiplier || 1),
                loyalty_multiplier_amount: Number(rawSettings.loyalty_multiplier_amount || 1000),
                loyalty_point_value: Number(rawSettings.loyalty_point_value || 0),
                loyalty_min_points: Number(rawSettings.loyalty_min_points || 0),
                google_sheet_url: rawSettings.google_sheet_url || '',
            };
            setStoreName(finalSettings.storeName);
            setStoreAddress(finalSettings.storeAddress);
            setStorePhone(finalSettings.storePhone);
            setStoreLogo(finalSettings.storeLogo);
            setEnablePreOrder(finalSettings.enablePreOrder);
            setEnableShift(rawSettings.enableShift === undefined ? true : rawSettings.enableShift === 'true');
            setEnableDineTable(finalSettings.enableDineTable);
            setLoyaltyActive(finalSettings.loyalty_active);
            setLoyaltyMultiplier(String(finalSettings.loyalty_multiplier));
            setLoyaltyMultiplierAmount(String(finalSettings.loyalty_multiplier_amount));
            setLoyaltyPointValue(String(finalSettings.loyalty_point_value));
            setLoyaltyMinPoints(String(finalSettings.loyalty_min_points));
            setGoogleSheetUrl(finalSettings.google_sheet_url);
            setShowImages(finalSettings.showImages);
            setIsDarkMode(finalSettings.theme === 'dark');
            setAllowNegativeStock(finalSettings.allowNegativeStock);
            setShowLogoOnReceipt(finalSettings.showLogoOnReceipt);
            setReceiptFooter(finalSettings.receiptFooter);
            setPrinterType(finalSettings.printerType);
            if (finalSettings.printerType === 'BLE') {
                setConnectedPrinter(finalSettings.printerAddress);
                setActiveTab('BLE');
            } else if (finalSettings.printerType === 'USB') {
                setConnectedPrinter(finalSettings.printerAddress);
                setActiveTab('USB');
            }
            setSettings(finalSettings);
        } catch (error) { console.error(error); }
    };

        const saveSettings = async () => {
        try {
            const db = await getDBConnection();
            const themeToSave = isDarkMode ? 'dark' : 'light';
            const settingsToSave = [
                ['storeName', storeName],
                ['storeAddress', storeAddress],
                ['storePhone', storePhone],
                ['storeLogo', storeLogo || ''],
                ['enablePreOrder', enablePreOrder ? 'true' : 'false'],
                ['enableShift', enableShift ? 'true' : 'false'],
                ['enableDineTable', enableDineTable ? 'true' : 'false'],
                ['showImages', showImages ? 'true' : 'false'],
                ['theme', themeToSave],
                ['allowNegativeStock', allowNegativeStock ? 'true' : 'false'],
                ['showLogoOnReceipt', showLogoOnReceipt ? 'true' : 'false'],
                ['receiptFooter', receiptFooter],
                ['loyalty_active', loyaltyActive ? 'true' : 'false'],
                ['loyalty_multiplier', loyaltyMultiplier],
                ['loyalty_multiplier_amount', loyaltyMultiplierAmount],
                ['loyalty_point_value', loyaltyPointValue],
                ['loyalty_min_points', loyaltyMinPoints],
                ['google_sheet_url', googleSheetUrl],
            ];
            for (const [key, value] of settingsToSave) {
                await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
            }
            if (connectedPrinter) {
                await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('printerAddress', ?)`, [connectedPrinter]);
                await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('printerType', ?)`, ['BLE']);
            }
            setSettings({ ...settings, storeName, storeAddress, storePhone, storeLogo, enablePreOrder, enableShift, enableDineTable, showImages, printerAddress: connectedPrinter, printerType: 'BLE', theme: themeToSave, allowNegativeStock, showLogoOnReceipt, receiptFooter,
                loyalty_active: loyaltyActive,
                loyalty_multiplier: Number(loyaltyMultiplier),
                loyalty_multiplier_amount: Number(loyaltyMultiplierAmount),
                loyalty_point_value: Number(loyaltyPointValue),
                loyalty_min_points: Number(loyaltyMinPoints),
                google_sheet_url: googleSheetUrl
            });
            setColorScheme(themeToSave);
        } catch (error) {
            console.error('Auto save error:', error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            saveSettings();
        }, 800);
        return () => clearTimeout(timer);
    }, [storeName, storeAddress, storePhone, storeLogo, enablePreOrder, enableShift, enableDineTable, showImages, isDarkMode, allowNegativeStock, showLogoOnReceipt, receiptFooter, loyaltyActive, loyaltyMultiplier, loyaltyMultiplierAmount, loyaltyPointValue, loyaltyMinPoints, googleSheetUrl]);


    // ── Bluetooth ─────────────────────────────────────────────────────────────
    const scanDevices = async () => {
        setIsScanning(true);
        try {
            if (activeTab === 'BLE') {
                const hasPerms = await requestPrinterPermissions();
                if (!hasPerms) { Alert.alert('Izin Ditolak', 'Izin Bluetooth diperlukan.'); setIsScanning(false); return; }
                try { await BLEPrinter.init(); } catch { Alert.alert('Info', 'Nyalakan Bluetooth terlebih dahulu.'); return; }
                const results = await BLEPrinter.getDeviceList();
                setBleDevices(results);
            } else {
                try { await USBPrinter.init(); } catch { /* Already initialized */ }
                const results = await USBPrinter.getDeviceList();
                setUsbDevices(results);
            }
        } catch { Alert.alert('Error', 'Gagal scan perangkat.'); }
        finally { setIsScanning(false); }
    };

    // ── Test Print ───────────────────────────────────────────────────────────
    const handleTestPrint = async () => {
        if (!connectedPrinter || !printerType) {
            Alert.alert('Info', 'Belum ada printer yang tersambung.');
            return;
        }

        const hasPerms = await requestPrinterPermissions();
        if (!hasPerms && printerType === 'BLE') {
            Alert.alert('Izin Ditolak', 'Dibutuhkan izin Bluetooth untuk mencetak.');
            return;
        }

        try {
            const printerClass = printerType === 'USB' ? USBPrinter : BLEPrinter;
            try { await printerClass.init(); } catch (e) { /* Already initialized */ }
            try {
                if (printerType === 'BLE') {
                    await printerClass.connectPrinter(connectedPrinter);
                } else {
                    const [vendorStr, productStr] = connectedPrinter.split('|');
                    await printerClass.connectPrinter(Number(vendorStr), Number(productStr));
                }
            } catch (e) { /* Already connected */ }

            // Print logo
            if (showLogoOnReceipt === true || String(showLogoOnReceipt) === 'true') {
                try {
                    let logoToPrint = RECEIPT_LOGO_BASE64;
                    if (storeLogo) {
                        const logoUrl = storeLogo.startsWith('http') ? storeLogo : `${API_URL}${storeLogo}`;
                        const tempFile = `${RNFS.CachesDirectoryPath}/temp_print_logo.png`;
                        const res = await RNFS.downloadFile({ fromUrl: logoUrl, toFile: tempFile }).promise;
                        if (res.statusCode === 200) {
                            logoToPrint = await RNFS.readFile(tempFile, 'base64');
                        }
                    }
                    await printerClass.printImageBase64(logoToPrint, { imageWidth: 180 });
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
                } catch (logoErr) {
                    console.warn('Logo print failed (lanjut cetak teks):', logoErr);
                }
            }

            // Print test receipt text
            const LINE = '--------------------------------\n';
            const WIDTH = 32;
            const storeNameForPrint = settings.storeName || 'LitePOS';
            let text = '';
            text += center(storeNameForPrint, WIDTH) + '\n';
            if (settings.storeAddress) {
                text += center(settings.storeAddress.substring(0, WIDTH), WIDTH) + '\n';
            }
            if (settings.storePhone) {
                text += center(`Telp: ${settings.storePhone} `, WIDTH) + '\n';
            }
            text += LINE;
            text += `No: TEST-001 \n`;
            text += `Kasir: TEST \n`;
            text += `${new Date().toLocaleString('id-ID')} \n`;
            text += LINE;
            text += 'TEST PRINT \n';
            text += '1 x 10000                10000\n';
            text += LINE;
            text += `TOTAL: Rp 10000 \n`;
            text += LINE;
            if (settings.receiptFooter) {
                text += center(settings.receiptFooter, WIDTH) + '\n';
            }
            text += 'Terima Kasih!\n';

            await printerClass.printText(text);
            Alert.alert('Berhasil', 'Test print berhasil dicetak.');
        } catch (e: any) {
            Alert.alert('Gagal', e?.message || 'Error saat mencetak. Pastikan printer menyala dan tersambung.');
        }
    };

    const center = (text: string, width: number): string => {
        const len = text.length;
        const spaces = Math.max(0, Math.floor((width - len) / 2));
        return ' '.repeat(spaces) + text;
    };

    const savePrinterToDb = async (address: string, type: 'BLE' | 'USB') => {
        const db = await getDBConnection();
        await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('printerAddress', ?)`, [address]);
        await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('printerType', ?)`, [type]);
        setSettings({ ...settings, printerAddress: address, printerType: type });
    };

    const connectBLE = async (address: string) => {
        setIsScanning(true);
        try {
            const hasPerms = await requestPrinterPermissions();
            if (!hasPerms) { Alert.alert('Izin Ditolak', 'Izin Bluetooth diperlukan.'); setIsScanning(false); return; }
            await BLEPrinter.connectPrinter(address);
            setConnectedPrinter(address); setPrinterType('BLE');
            await savePrinterToDb(address, 'BLE');
            Alert.alert('Tersambung', 'Printer Bluetooth siap digunakan.');
        } catch (e: any) { Alert.alert('Gagal', e?.message || 'Tidak bisa connect ke printer.'); }
        finally { setIsScanning(false); }
    };

    const connectUSB = async (device: any) => {
        setIsScanning(true);
        try {
            await USBPrinter.connectPrinter(device.vendor_id, device.product_id);
            const printerId = `${device.vendor_id}|${device.product_id}`;
            setConnectedPrinter(printerId); setPrinterType('USB');
            await savePrinterToDb(printerId, 'USB');
            Alert.alert('Tersambung', 'Printer USB siap digunakan.');
        } catch (e: any) { Alert.alert('Gagal', e?.message || 'Tidak bisa connect.'); }
        finally { setIsScanning(false); }
    };

    const handleBackup = async () => {
        if (Platform.OS === 'android') await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        try {
            const db = await getDBConnection();
            const fetchAll = async (sql: string) => {
                const [res] = await db.executeSql(sql);
                const arr: any[] = [];
                for (let i = 0; i < res.rows.length; i++) arr.push(res.rows.item(i));
                return arr;
            };
            const backupData = {
                version: 1, createdAt: new Date().toISOString(), appName: 'LitePOS',
                data: {
                    settings: await fetchAll('SELECT * FROM settings'),
                    categories: await fetchAll('SELECT * FROM categories'),
                    products: await fetchAll('SELECT * FROM products'),
                    users: await fetchAll('SELECT * FROM users'),
                    customers: await fetchAll('SELECT * FROM customers'),
                    suppliers: await fetchAll('SELECT * FROM suppliers'),
                    packages: await fetchAll('SELECT * FROM packages'),
                    package_items: await fetchAll('SELECT * FROM package_items'),
                    transactions: await fetchAll('SELECT * FROM transactions ORDER BY createdAt ASC'),
                    transaction_items: await fetchAll('SELECT * FROM transaction_items'),
                    expenses: await fetchAll('SELECT * FROM expenses ORDER BY createdAt ASC'),
                }
            };
            const jsonStr = JSON.stringify(backupData, null, 2);
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `Backup_LitePOS_${dateStr}.json`;
            const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, jsonStr, 'utf8');
            Alert.alert('Backup Berhasil', `File backup tersimpan di:\nFolder Download → ${fileName}`);
        } catch { Alert.alert('Gagal Backup', 'Terjadi kesalahan saat membuat backup.'); }
    };

    const handleRestore = async () => {
        Alert.alert('Restore Data', 'Proses ini akan MENGHAPUS SEMUA DATA saat ini dan menggantinya dengan data dari file backup.', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Pilih File Backup', onPress: async () => {
                    try {
                        const [file] = await pick({ type: [types.json, types.allFiles] });
                        if (!file?.uri) return;
                        const content = await RNFS.readFile(file.uri.replace('content://', '/').startsWith('/') ? file.uri : file.uri, 'utf8');
                        let backup: any;
                        try { backup = JSON.parse(content); } catch { Alert.alert('Error', 'File bukan JSON valid.'); return; }
                        if (!backup?.data || !backup?.appName) { Alert.alert('Error', 'File backup tidak valid.'); return; }

                        Alert.alert('Konfirmasi', `Backup dari: ${backup.createdAt?.substring(0, 10) || '?'}\nLanjutkan restore?`, [
                            { text: 'Batal', style: 'cancel' },
                            {
                                text: 'Restore', style: 'destructive', onPress: async () => {
                                    try {
                                        const db = await getDBConnection();
                                        const { data } = backup;
                                        await db.executeSql('DELETE FROM transaction_items');
                                        await db.executeSql('DELETE FROM transactions');
                                        await db.executeSql('DELETE FROM expenses');
                                        await db.executeSql('DELETE FROM customers');
                                        await db.executeSql('DELETE FROM suppliers');
                                        await db.executeSql('DELETE FROM package_items');
                                        await db.executeSql('DELETE FROM packages');
                                        await db.executeSql('DELETE FROM products');
                                        await db.executeSql('DELETE FROM categories');
                                        await db.executeSql('DELETE FROM settings');
                                        await db.executeSql('DELETE FROM users');

                                        for (const s of (data.settings || [])) await db.executeSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
                                        for (const c of (data.categories || [])) await db.executeSql('INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)', [c.id, c.name]);
                                        for (const p of (data.products || [])) await db.executeSql('INSERT OR REPLACE INTO products (id, categoryId, name, price, costPrice, enableCostPrice, stock, imageUrl, isUnlimitedStock) VALUES (?,?,?,?,?,?,?,?,?)', [p.id, p.categoryId, p.name, p.price, p.costPrice || 0, p.enableCostPrice || 0, p.stock || 0, p.imageUrl || null, p.isUnlimitedStock || 0]);
                                        for (const u of (data.users || [])) await db.executeSql('INSERT OR REPLACE INTO users (id, name, pin, role) VALUES (?,?,?,?)', [u.id, u.name, u.pin, u.role || 'CASHIER']);
                                        for (const c of (data.customers || [])) await db.executeSql('INSERT OR REPLACE INTO customers (id, name, phone, notes, loyaltyDiscount) VALUES (?,?,?,?,?)', [c.id, c.name, c.phone || null, c.notes || null, c.loyaltyDiscount || 0]);
                                        for (const s of (data.suppliers || [])) await db.executeSql('INSERT OR REPLACE INTO suppliers (id, name, phone, address, notes) VALUES (?,?,?,?,?)', [s.id, s.name, s.phone || null, s.address || null, s.notes || null]);
                                        for (const p of (data.packages || [])) await db.executeSql('INSERT OR REPLACE INTO packages (id, name, description, price, isActive, createdAt) VALUES (?,?,?,?,?,?)', [p.id, p.name, p.description || null, p.price, p.isActive, p.createdAt]);
                                        for (const pi of (data.package_items || [])) await db.executeSql('INSERT OR REPLACE INTO package_items (id, packageId, productId, quantity) VALUES (?,?,?,?)', [pi.id, pi.packageId, pi.productId, pi.quantity]);
                                        for (const t of (data.transactions || [])) await db.executeSql('INSERT OR REPLACE INTO transactions (id, invoiceNumber, grandTotal, discountAmount, paymentMethod, cashAmount, changeAmount, customerId, customerName, createdAt, status, preOrderDate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [t.id, t.invoiceNumber, t.grandTotal, t.discountAmount || 0, t.paymentMethod, t.cashAmount || 0, t.changeAmount || 0, t.customerId || null, t.customerName || null, t.createdAt, t.status || 'COMPLETED', t.preOrderDate || null]);
                                        for (const ti of (data.transaction_items || [])) await db.executeSql('INSERT OR REPLACE INTO transaction_items (id, transactionId, productId, quantity, price, notes) VALUES (?,?,?,?,?,?)', [ti.id, ti.transactionId, ti.productId || null, ti.quantity, ti.price, ti.notes || null]);
                                        for (const e of (data.expenses || [])) await db.executeSql('INSERT OR REPLACE INTO expenses (id, description, amount, category, createdAt) VALUES (?,?,?,?,?)', [e.id, e.description, e.amount, e.category || 'Umum', e.createdAt]);

                                        Alert.alert('Restore Berhasil', 'Restart aplikasi untuk memuat ulang.', [{ text: 'OK', onPress: () => loadSettingsFromDB() }]);
                                    } catch (e) { console.error(e); Alert.alert('Error', 'Gagal restore data.'); }
                                }
                            }
                        ]);
                    } catch (e: any) {
                        if (e?.code !== 'DOCUMENT_PICKER_CANCELED') Alert.alert('Error', 'Gagal membuka file.');
                    }
                }
            }
        ]);
    };

    return (
        <View style={tw`flex-1 bg-gray-50 dark:bg-gray-900`}>
            {/* Header */}
            <View style={tw`bg-white dark:bg-gray-800 px-6 pt-4 pb-4 border-b border-gray-100 dark:border-gray-700`}>
                <View style={tw`flex-row items-center justify-between`}>
                    <View>
                        <Text style={tw`text-2xl font-black text-gray-800 dark:text-gray-100`}>Pengaturan</Text>
                        <Text style={tw`text-gray-500 dark:text-gray-400 text-sm mt-0.5`}>Konfigurasi aplikasi kasir</Text>
                    </View>
                    <View style={tw`bg-green-100 dark:bg-green-900/40 px-3 py-1.5 rounded-lg flex-row items-center`}>
        <Icon name="check-circle" size={12} color={tw.color('green-600')} style={tw`mr-1`} />
        <Text style={tw`text-green-700 dark:text-green-400 font-bold text-xs`}>Tersimpan otomatis</Text>
    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={tw`p-4 pb-10`}>
                {/* ── PROFIL TOKO ────────────────────────────────────────────────── */}
                <SectionItem
                    icon="storefront-outline" iconColor={tw.color('blue-600')}
                    label="Profil Toko" sublabel="Nama, alamat, logo bisnis"
                    isOpen={openSection === 'profile'} onPress={() => toggleSection('profile')}
                >
                    <View style={tw`pt-4`}>
                        <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Nama Toko (Tercetak di Struk)</Text>
                        <TextInput style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 mb-3`}
                            value={storeName} onChangeText={setStoreName} placeholder="Warung Makan Barokah" />

                        <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Alamat Toko</Text>
                        <TextInput style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-3`}
                            value={storeAddress} onChangeText={setStoreAddress} placeholder="Jl. Contoh No. 1" multiline />

                        <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>No. Telepon</Text>
                        <TextInput style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-3`}
                            value={storePhone} onChangeText={setStorePhone} placeholder="08xx-xxxx-xxxx" keyboardType="phone-pad" />

                        <Text style={tw`text-xs font-bold text-gray-500 mb-2`}>Logo Toko</Text>
                        <View style={tw`flex-row items-center mb-4`}>
                            {storeLogo ? (
                                <Image source={{ uri: storeLogo }} style={tw`w-16 h-16 rounded-xl mr-4 border border-gray-200`} resizeMode="contain" />
                            ) : (
                                <View style={tw`w-16 h-16 rounded-xl mr-4 bg-gray-100 dark:bg-gray-900 items-center justify-center border border-dashed border-gray-300`}>
                                    <Icon name="camera" size={20} color={tw.color('gray-400')} />
                                </View>
                            )}
                            <View>
                                <TouchableOpacity style={tw`bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg mb-2`}
                                    onPress={async () => {
                                        const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
                                        if (!result.didCancel && result.assets?.[0]?.uri) setStoreLogo(result.assets[0].uri);
                                    }}>
                                    <Text style={tw`text-blue-600 font-bold text-xs`}>Pilih Logo</Text>
                                </TouchableOpacity>
                                {storeLogo && <TouchableOpacity onPress={() => setStoreLogo(null)}><Text style={tw`text-red-400 text-xs font-bold`}>Hapus Logo</Text></TouchableOpacity>}
                            </View>
                        </View>
                        
                        <View style={tw`flex-row justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-xl mb-4 border border-gray-100 dark:border-gray-800`}>
                            <View>
                                <Text style={tw`text-sm font-bold text-gray-800 dark:text-gray-100`}>Tampilkan Logo di Struk</Text>
                                <Text style={tw`text-xs text-gray-500 dark:text-gray-400`}>Cetak logo bawaan pada bagian atas struk</Text>
                            </View>
                            <Switch value={showLogoOnReceipt} onValueChange={setShowLogoOnReceipt} trackColor={{ false: '#d1d5db', true: '#93c5fd' }} thumbColor={showLogoOnReceipt ? '#2563eb' : '#f3f4f6'} />
                        </View>

                        <Text style={tw`text-xs font-bold text-gray-500 mb-1 mt-3`}>Footer Struk (Kalimat Penutup)</Text>
                        <TextInput style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-1`}
                            value={receiptFooter} onChangeText={setReceiptFooter} placeholder="Contoh: Terima kasih telah berbelanja!" multiline />
                        <Text style={tw`text-[10px] text-gray-400 mb-2`}>Teks ini akan tampil di bagian bawah struk</Text>
                    </View>
                </SectionItem>

                {/* ── FITUR TOKO ─────────────────────────────────────────────────── */}
                <SectionItem
                    icon="cog-outline" iconColor={tw.color('purple-600')}
                    label="Fitur Toko" sublabel="Pre-order, shift, meja dine-in"
                    isOpen={openSection === 'features'} onPress={() => toggleSection('features')}
                >
                    <View style={tw`pt-4`}>
                        {/* Show Images */}
                        <View style={tw`flex-row items-center justify-between mb-4`}>
                            <View style={tw`flex-1 mr-4`}>
                                <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Tampilkan Gambar Produk</Text>
                                <Text style={tw`text-gray-500 text-xs mt-0.5`}>Grid view dengan gambar di kasir</Text>
                            </View>
                            <Switch value={showImages} onValueChange={setShowImages} trackColor={{ false: '#d1d5db', true: '#93c5fd' }} thumbColor={showImages ? '#2563eb' : '#f3f4f6'} />
                        </View>

                        {/* Pre-order */}
                        <View style={tw`flex-row items-center justify-between mb-4 pt-4 border-t border-gray-100 dark:border-gray-800`}>
                            <View style={tw`flex-1 mr-4`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Icon name="calendar" size={14} color={tw.color('purple-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Pre-Order</Text>
                                </View>
                                <Text style={tw`text-gray-500 text-xs`}>Terima pesanan untuk tanggal tertentu</Text>
                            </View>
                            <Switch value={enablePreOrder} onValueChange={setEnablePreOrder} trackColor={{ false: '#d1d5db', true: '#c4b5fd' }} thumbColor={enablePreOrder ? '#7c3aed' : '#f3f4f6'} />
                        </View>

                        {/* Shift */}
                        <View style={tw`flex-row items-center justify-between mb-4 pt-4 border-t border-gray-100 dark:border-gray-800`}>
                            <View style={tw`flex-1 mr-4`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Icon name="briefcase-outline" size={14} color={tw.color('blue-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Shift Kasir</Text>
                                </View>
                                <Text style={tw`text-gray-500 text-xs`}>Wajib buka shift sebelum transaksi</Text>
                            </View>
                            <Switch value={enableShift} onValueChange={setEnableShift} trackColor={{ false: '#d1d5db', true: '#93c5fd' }} thumbColor={enableShift ? '#2563eb' : '#f3f4f6'} />
                        </View>

                        {/* Dine Table */}
                        <View style={tw`flex-row items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800`}>
                            <View style={tw`flex-1 mr-4`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Icon name="silverware-fork-knife" size={14} color={tw.color('green-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Manajemen Meja</Text>
                                </View>
                                <Text style={tw`text-gray-500 text-xs`}>Kelola meja dine-in (restoran, kafe)</Text>
                            </View>
                            <Switch value={enableDineTable} onValueChange={setEnableDineTable} trackColor={{ false: '#d1d5db', true: '#86efac' }} thumbColor={enableDineTable ? '#16a34a' : '#f3f4f6'} />
                        </View>

                        {/* Allow Negative Stock */}
                        <View style={tw`flex-row items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800`}>
                            <View style={tw`flex-1 mr-4`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Icon name="alert" size={14} color={tw.color('amber-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Izinkan Stok Minus</Text>
                                </View>
                                <Text style={tw`text-gray-500 text-xs`}>Transaksi tetap bisa jalan meski stok 0</Text>
                            </View>
                            <Switch value={allowNegativeStock} onValueChange={setAllowNegativeStock} trackColor={{ false: '#d1d5db', true: '#fcd34d' }} thumbColor={allowNegativeStock ? '#f59e0b' : '#f3f4f6'} />
                        </View>
                    </View>
                </SectionItem>

                {/* ── POIN LOYALITAS ──────────────────────────────────────────────── */}
                <SectionItem
                    icon="heart-outline" iconColor={tw.color('red-500')}
                    label="Poin Loyalitas" sublabel="Reward poin tiap belanja"
                    isOpen={openSection === 'loyalty'} onPress={() => toggleSection('loyalty')}
                >
                    <View style={tw`pt-4`}>
                        <View style={tw`flex-row items-center justify-between mb-4`}>
                            <View style={tw`flex-1 mr-4`}>
                                <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Aktifkan Poin Loyalitas</Text>
                                <Text style={tw`text-gray-500 text-xs mt-0.5`}>Berikan poin otomatis saat bayar</Text>
                            </View>
                            <Switch value={loyaltyActive} onValueChange={setLoyaltyActive} trackColor={{ false: '#d1d5db', true: '#fca5a5' }} thumbColor={loyaltyActive ? '#ef4444' : '#f3f4f6'} />
                        </View>

                        {loyaltyActive && (
                            <View style={tw`pt-4 border-t border-gray-100 dark:border-gray-800`}>
                                <View style={tw`mb-4`}>
                                    <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Setiap Belanja Senilai (Rp)</Text>
                                    <TextInput 
                                        style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100`}
                                        value={loyaltyMultiplierAmount}
                                        onChangeText={setLoyaltyMultiplierAmount}
                                        keyboardType="numeric"
                                        placeholder="Contoh: 1000"
                                    />
                                    <Text style={tw`text-[10px] text-gray-400 mt-1`}>Nominal belanja kelipatan untuk dapat poin</Text>
                                </View>

                                <View style={tw`mb-4`}>
                                    <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Dapatkan Poin Sebanyak</Text>
                                    <TextInput 
                                        style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100`}
                                        value={loyaltyMultiplier}
                                        onChangeText={setLoyaltyMultiplier}
                                        keyboardType="numeric"
                                        placeholder="Contoh: 1"
                                    />
                                    <Text style={tw`text-[10px] text-gray-400 mt-1`}>Misal: tiap belanja 1000 dapat 1 poin</Text>
                                </View>

                                <View style={tw`mb-4`}>
                                    <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Nilai 1 Poin Jika Ditukar (Rp)</Text>
                                    <TextInput 
                                        style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100`}
                                        value={loyaltyPointValue}
                                        onChangeText={setLoyaltyPointValue}
                                        keyboardType="numeric"
                                        placeholder="Contoh: 100"
                                    />
                                    <Text style={tw`text-[10px] text-gray-400 mt-1`}>Harga tukar per poin untuk jadi diskon</Text>
                                </View>

                                <View>
                                    <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Minimal Poin untuk Tukar</Text>
                                    <TextInput 
                                        style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100`}
                                        value={loyaltyMinPoints}
                                        onChangeText={setLoyaltyMinPoints}
                                        keyboardType="numeric"
                                        placeholder="Contoh: 50"
                                    />
                                    <Text style={tw`text-[10px] text-gray-400 mt-1`}>Batas minimal poin sebelum bisa digunakan</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </SectionItem>

                {/* ── TEMA ───────────────────────────────────────────────────────── */}
                <SectionItem
                    icon="moon-waning-crescent" iconColor={tw.color('indigo-600')}
                    label="Tema Aplikasi" sublabel={isDarkMode ? 'Dark Mode aktif' : 'Light Mode aktif'}
                    isOpen={openSection === 'theme'} onPress={() => toggleSection('theme')}
                >
                    <View style={tw`pt-4 flex-row items-center justify-between`}>
                        <View style={tw`flex-1 mr-4`}>
                            <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Tema Gelap</Text>
                            <Text style={tw`text-gray-500 text-xs mt-0.5`}>Dark mode untuk seluruh aplikasi</Text>
                        </View>
                        <Switch value={isDarkMode} onValueChange={(val) => { setIsDarkMode(val); setColorScheme(val ? 'dark' : 'light'); }}
                            trackColor={{ false: '#d1d5db', true: '#93c5fd' }} thumbColor={isDarkMode ? '#2563eb' : '#f3f4f6'} />
                    </View>
                </SectionItem>

                {/* ── PRINTER ───────────────────────────────────────────────────── */}
                <SectionItem
                    icon="printer" iconColor={tw.color('teal-600')}
                    label="Printer" sublabel={connectedPrinter ? `${printerType} tersambung` : 'Belum dikonfigurasi'}
                    isOpen={openSection === 'printer'} onPress={() => toggleSection('printer')}
                >
                    <View style={tw`pt-4`}>
                        {connectedPrinter && (
                            <View style={tw`bg-green-50 border border-green-200 p-3 rounded-xl mb-4 flex-row items-center`}>
                                <Icon name="printer" size={14} color={tw.color('green-600')} />
                                <Text style={tw`text-green-700 font-bold ml-2 flex-1 text-xs`}>Tersambung: {printerType} — {connectedPrinter.substring(0, 20)}</Text>
                            </View>
                        )}
                        {/* Toggle was here */}
                        <View style={tw`flex-row items-center justify-between mb-3`}>
                            <Text style={tw`text-gray-800 dark:text-gray-100 font-bold text-sm`}>Daftar Perangkat</Text>
                            <View style={tw`flex-row`}>
                                <TouchableOpacity style={tw`bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg flex-row items-center mr-2`} onPress={handleTestPrint} disabled={!connectedPrinter}>
                                    <Icon name="printer" size={14} color={connectedPrinter ? tw.color('gray-600') : tw.color('gray-400')} style={tw`mr-2`} />
                                    <Text style={tw`text-sm font-bold ${connectedPrinter ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>Test Print</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={tw`bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg flex-row items-center`} onPress={scanDevices} disabled={isScanning}>
                                    <Icon name="refresh" size={14} color={tw.color('gray-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-sm font-bold text-gray-600 dark:text-gray-300`}>{isScanning ? 'Mencari...' : 'Scan'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {activeTab === 'BLE' ? (
                            bleDevices.length === 0 ? (
                                <Text style={tw`text-center text-gray-400 py-4 text-xs font-bold`}>Tekan Scan lalu pilih printer</Text>
                            ) : bleDevices.map((device: any, i: number) => (
                                <TouchableOpacity key={i} style={tw`flex-row items-center justify-between py-3 border-t border-gray-100 dark:border-gray-800 ${connectedPrinter === device.inner_mac_address ? 'bg-blue-50 px-2 rounded-xl' : ''}`}
                                    onPress={() => connectBLE(device.inner_mac_address)}>
                                    <View>
                                        <Text style={tw`font-bold ${connectedPrinter === device.inner_mac_address ? 'text-blue-700' : 'text-gray-800 dark:text-gray-100'}`}>{device.device_name || 'Printer BT'}</Text>
                                        <Text style={tw`text-xs text-gray-400 mt-0.5`}>{device.inner_mac_address}</Text>
                                    </View>
                                    {connectedPrinter === device.inner_mac_address && (
                                        <View style={tw`flex-row items-center bg-blue-100 px-2 py-1 rounded`}>
                                            <Icon name="check" size={10} color={tw.color('blue-600')} style={tw`mr-1`} />
                                            <Text style={tw`text-xs font-black text-blue-600`}>Aktif</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))
                        ) : (
                            usbDevices.length === 0 ? (
                                <Text style={tw`text-center text-gray-400 py-4 text-xs font-bold`}>Sambungkan kabel OTG lalu Scan</Text>
                            ) : usbDevices.map((device: any, i: number) => {
                                const devId = `${device.vendor_id}|${device.product_id}`;
                                return (
                                    <TouchableOpacity key={i} style={tw`flex-row items-center justify-between py-3 border-t border-gray-100 dark:border-gray-800 ${connectedPrinter === devId ? 'bg-blue-50 px-2 rounded-xl' : ''}`}
                                        onPress={() => connectUSB(device)}>
                                        <View>
                                            <Text style={tw`font-bold ${connectedPrinter === devId ? 'text-blue-700' : 'text-gray-800 dark:text-gray-100'}`}>{device.device_name || 'USB Printer'}</Text>
                                            <Text style={tw`text-xs text-gray-400 mt-0.5`}>V:{device.vendor_id} P:{device.product_id}</Text>
                                        </View>
                                        {connectedPrinter === devId && (
                                            <View style={tw`flex-row items-center bg-blue-100 px-2 py-1 rounded`}>
                                                <Icon name="check" size={10} color={tw.color('blue-600')} style={tw`mr-1`} />
                                                <Text style={tw`text-xs font-black text-blue-600`}>Aktif</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </SectionItem>

                {/* ── PENGGUNA ──────────────────────────────────────────────────── */}
                <SectionItem
                    icon="account-group" iconColor={tw.color('red-500')}
                    label="Pengguna" sublabel="Kelola akun kasir & admin"
                    isOpen={openSection === 'users'} onPress={() => toggleSection('users')}
                >
                    <View style={tw`pt-4`}>
                        <Text style={tw`text-gray-500 text-sm mb-3`}>Tambah, edit, dan hapus akun kasir/admin.</Text>
                        <TouchableOpacity style={tw`bg-gray-900 py-3 rounded-xl flex-row justify-center items-center`}
                            onPress={() => navigation.navigate('UserManagement')}>
                            <Icon name="account-multiple" size={16} color="white" style={tw`mr-2`} />
                            <Text style={tw`font-bold text-white`}>Kelola Akun Pengguna</Text>
                        </TouchableOpacity>
                    </View>
                </SectionItem>

                {/* ── BACKUP & RESTORE ──────────────────────────────────────────── */}
                <SectionItem
                    icon="database" iconColor={tw.color('amber-600')}
                    label="Backup & Restore" sublabel="Cadangkan & pulihkan data"
                    isOpen={openSection === 'backup'} onPress={() => toggleSection('backup')}
                >
                    <View style={tw`pt-4`}>
                        <Text style={tw`text-gray-500 text-sm mb-4`}>
                            Simpan semua data ke file JSON. File bisa digunakan untuk restore ke device lain.
                        </Text>
                        <TouchableOpacity style={tw`bg-blue-50 border border-blue-200 py-3 rounded-xl flex-row justify-center items-center mb-3`} onPress={handleBackup}>
                            <Icon name="harddisk" size={16} color={tw.color('blue-600')} style={tw`mr-2`} />
                            <Text style={tw`font-bold text-blue-700`}>Export Backup JSON</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={tw`bg-amber-50 border border-amber-300 py-3 rounded-xl flex-row justify-center items-center mb-3`} onPress={handleRestore}>
                            <Icon name="restore" size={16} color={tw.color('amber-600')} style={tw`mr-2`} />
                            <Text style={tw`font-bold text-amber-700`}>Restore dari Backup</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={tw`bg-red-50 border border-red-300 py-3 rounded-xl flex-row justify-center items-center`}
                            onPress={() => {
                                Alert.alert('Reset Semua Data', 'Tindakan ini akan menghapus SEMUA data. Tidak bisa dikembalikan!', [
                                    { text: 'Batal', style: 'cancel' },
                                    {
                                        text: 'Hapus Semua', style: 'destructive', onPress: async () => {
                                            try {
                                                const db = await getDBConnection();
                                                for (const t of ['transaction_items', 'transactions', 'expenses', 'stock_receipt_items', 'stock_receipts', 'shifts', 'customers', 'suppliers', 'package_items', 'packages', 'product_addons', 'products', 'categories', 'settings']) {
                                                    await db.executeSql(`DELETE FROM ${t}`);
                                                }
                                                Alert.alert('Selesai', 'Semua data dihapus. Restart aplikasi.');
                                            } catch { Alert.alert('Error', 'Gagal menghapus data.'); }
                                        }
                                    }
                                ]);
                            }}>
                            <Icon name="delete-outline" size={16} color={tw.color('red-600')} style={tw`mr-2`} />
                            <Text style={tw`font-bold text-red-600`}>Reset Semua Data</Text>
                        </TouchableOpacity>
                        <View style={tw`flex-row items-center justify-center mt-3`}>
                            <Icon name="alert" size={11} color={tw.color('gray-400')} style={tw`mr-1`} />
                            <Text style={tw`text-[10px] text-gray-400 italic`}>Restore akan menggantikan semua data saat ini</Text>
                        </View>
                    </View>
                </SectionItem>

                {/* ✨ INTEGRASI LAPORAN ✨ */}
                <SectionItem
                    icon="database" iconColor={tw.color('green-500')}
                    label="Integrasi Google Sheets" sublabel="Kirim laporan ke Sheets"
                    isOpen={openSection === 'gsheets'} onPress={() => toggleSection('gsheets')}
                >
                    <View style={tw`pt-4`}>
                        <Text style={tw`text-gray-500 text-sm mb-4`}>
                            Masukkan Web App URL dari Google Apps Script untuk menghubungkan laporan ke Google Sheets Anda secara otomatis.
                        </Text>
                        <View style={tw`mb-4`}>
                            <Text style={tw`text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider ml-1`}>Web App URL</Text>
                            <TextInput
                                style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 font-medium`}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                placeholderTextColor={tw.color('gray-400')}
                                value={googleSheetUrl}
                                onChangeText={setGoogleSheetUrl}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                        
                        {/* Button was here */}
                    </View>
                </SectionItem>

                {/* ── SINKRONISASI ────────────────────────────────────────────────── */}
                <SectionItem
                    icon="refresh" iconColor={tw.color('blue-500')}
                    label="Sinkronisasi Server" sublabel="Tarik/Dorong data ke Web"
                    isOpen={openSection === 'sync'} onPress={() => toggleSection('sync')}
                >
                    <View style={tw`pt-4`}>
                        <Text style={tw`text-gray-500 text-sm mb-4`}>
                            Sinkronisasi data Master (Produk, Kategori) dari Server, dan dorong sisa Transaksi Lokal ke Server.
                        </Text>
                        <TouchableOpacity 
                            style={tw`bg-blue-600 py-3.5 rounded-xl flex-row justify-center items-center mb-2`}
                            onPress={async () => {
                                Alert.alert('Sinkronisasi', 'Mulai sinkronisasi data dengan server?', [
                                    { text: 'Batal', style: 'cancel' },
                                    {
                                        text: 'Ya, Sinkron',
                                        onPress: async () => {
                                            try {
                                                const { syncService } = require('../services/syncService');
                                                // 1. Ambil data master
                                                console.log('[SYNC] Starting syncMasterData...');
                                                const masterRes = await syncService.syncMasterData();
                                                console.log('[SYNC] syncMasterData result:', masterRes);
                                                if (!masterRes.success) {
                                                    Alert.alert('Gagal', 'Gagal sinkron data master dari server: ' + JSON.stringify(masterRes.error || 'Unknown error'));
                                                    return;
                                                }
                                                // 2. Dorong data lokal
                                                console.log('[SYNC] Starting pushLocalData...');
                                                const pushRes = await syncService.pushLocalData();
                                                console.log('[SYNC] pushLocalData result:', pushRes);
                                                if (!pushRes.success) {
                                                    Alert.alert('Peringatan', 'Data master berhasil ditarik, tapi gagal mendorong data lokal ke server.');
                                                    return;
                                                }
                                                // 3. Tarik histori transaksi dari server (30 hari)
                                                console.log('[SYNC] Starting syncTransactionHistory...');
                                                const historyRes = await syncService.syncTransactionHistory();
                                                console.log('[SYNC] syncTransactionHistory result:', historyRes);
                                                if (!historyRes.success) {
                                                    console.warn('[SYNC] Gagal sync histori transaksi:', historyRes.error);
                                                }
                                                // 4. Reload settings dari SQLite ke Zustand agar UI langsung update
                                                try {
                                                    const db = await getDBConnection();
                                                    const [settingsRes] = await db.executeSql('SELECT * FROM settings');
                                                    let reloadedSettings: any = {};
                                                    for (let i = 0; i < settingsRes.rows.length; i++) {
                                                        const row = settingsRes.rows.item(i);
                                                        if (['showImages', 'enablePreOrder', 'enableShift', 'enableDineTable', 'allowNegativeStock', 'loyalty_active'].includes(row.key)) {
                                                            reloadedSettings[row.key] = row.value === 'true';
                                                        } else if (['loyalty_multiplier', 'loyalty_multiplier_amount', 'loyalty_point_value', 'loyalty_min_points'].includes(row.key)) {
                                                            reloadedSettings[row.key] = Number(row.value || 0);
                                                        } else {
                                                            reloadedSettings[row.key] = row.value || null;
                                                        }
                                                    }
                                                    useStore.getState().setSettings(reloadedSettings);
                                                } catch (e) { console.warn('Gagal reload settings setelah sync:', e); }
                                                Alert.alert('Berhasil', 'Sinkronisasi dua arah selesai! Data terbaru sudah diunduh.');
                                            } catch (e) {
                                                Alert.alert('Error', 'Terjadi kesalahan sistem.');
                                            }
                                        }
                                    }
                                ]);
                            }}
                        >
                            <Icon name="refresh" size={16} color="white" style={tw`mr-2`} />
                            <Text style={tw`font-bold text-white`}>Mulai Sinkronisasi</Text>
                        </TouchableOpacity>
                        <Text style={tw`text-[10px] text-gray-400 text-center`}>Catatan: HP otomatis sinkron setiap 60 detik di background.</Text>
                    </View>
                </SectionItem>

                {/* ── TENTANG APLIKASI ──────────────────────────────────────────── */}
                <SectionItem
                    icon="information-outline" iconColor={tw.color('gray-500')}
                    label="Tentang Aplikasi" sublabel="LitePOS v1.0.0"
                    isOpen={openSection === 'about'} onPress={() => toggleSection('about')}
                >
                    <View style={tw`pt-4 items-center`}>
                        <Text style={tw`text-2xl font-black text-gray-800 dark:text-gray-100 mb-1`}>LitePOS</Text>
                        <Text style={tw`text-gray-500 text-sm mb-3`}>Versi 3.0.0</Text>
                        <Text style={tw`text-gray-400 text-xs text-center mb-5`}>
                            Aplikasi kasir & manajemen bisnis untuk UMKM Indonesia.
                        </Text>

                        <TouchableOpacity
                            style={tw`bg-green-500 w-full py-3.5 rounded-2xl flex-row items-center justify-center mb-3`}
                            onPress={() => Linking.openURL('https://wa.me/6285156492409?text=Halo%20LitePOS!%20Saya%20ingin%20memberikan%20kritik%20%26%20saran%20untuk%20aplikasi%20ini.')}
                        >
                            <Icon name="message-outline" size={18} color="white" style={tw`mr-2`} />
                            <Text style={tw`text-white font-bold text-sm`}>Kritik & Saran</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={tw`bg-green-600 w-full py-3.5 rounded-2xl flex-row items-center justify-center mb-3`}
                            onPress={() => Linking.openURL('https://wa.me/6285156492409?text=Halo%20LitePOS!%20Saya%20tertarik%20untuk%20request%20tambah%20fitur%20baru.')}
                        >
                            <Icon name="rocket-launch-outline" size={18} color="white" style={tw`mr-2`} />
                            <Text style={tw`text-white font-bold text-sm`}>Request Tambah Fitur</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={tw`bg-green-700 w-full py-3.5 rounded-2xl flex-row items-center justify-center`}
                            onPress={() => Linking.openURL('https://wa.me/6285156492409?text=Halo!%20Saya%20tertarik%20untuk%20custom%20pembuatan%20aplikasi.%20Bisa%20bantu%3F')}
                        >
                            <Icon name="cellphone" size={18} color="white" style={tw`mr-2`} />
                            <Text style={tw`text-white font-bold text-sm`}>Custom Aplikasi Lain</Text>
                        </TouchableOpacity>

                        <Text style={tw`text-gray-400 text-[10px] mt-3`}>WhatsApp: 0851-5649-2409</Text>
                    </View>
                </SectionItem>
            </ScrollView>
        </View>
    );
}
