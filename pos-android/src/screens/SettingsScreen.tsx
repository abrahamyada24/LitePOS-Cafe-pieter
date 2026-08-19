import React, { useEffect, useRef, useState } from 'react';
import {
    Alert, PermissionsAndroid, Platform, View, Text, TouchableOpacity,
    ScrollView, TextInput, Switch, Image, LayoutAnimation, UIManager, Linking,
    Modal, ActivityIndicator
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
import ViewShot from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import api, { DEFAULT_API_URL, getApiBaseUrl, setApiBaseUrl as persistApiBaseUrl } from '../services/api';
import { connectConfiguredPrinter } from '../utils/printerConnection';
import { clearAuthSession, getAuthToken, OFFLINE_SESSION_TOKEN } from '../services/secureAuthStorage';
import { activateLicense, licenseToSettings } from '../services/licenseService';
import { clearOperationalLocalData, syncService } from '../services/syncService';
import {
    getReceiptLogoPrintOptions,
    RECEIPT_LOGO_CAPTURE_HEIGHT,
    RECEIPT_LOGO_CAPTURE_WIDTH,
    RECEIPT_LOGO_INNER_HEIGHT,
    RECEIPT_LOGO_INNER_WIDTH,
    resolveReceiptLogoUri,
} from '../utils/receiptLogo';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ResetType = 'STOCK' | 'TRANSACTIONS' | 'ALL';
type TransactionResetMode = 'ALL' | 'RANGE';

const RESET_OPTIONS: Array<{
    type: ResetType;
    label: string;
    phrase: string;
    icon: string;
    description: string;
    successMessage: string;
}> = [
    {
        type: 'STOCK',
        label: 'Reset Stok',
        phrase: 'RESET STOK',
        icon: 'package-variant-closed-remove',
        description: 'Nolkan stok produk dan hapus riwayat stok. Katalog serta transaksi tetap ada.',
        successMessage: 'Stok seluruh produk menjadi 0. Katalog dan transaksi tetap tersimpan.',
    },
    {
        type: 'TRANSACTIONS',
        label: 'Reset Transaksi',
        phrase: 'RESET TRANSAKSI',
        icon: 'receipt-text-remove-outline',
        description: 'Hapus transaksi, pembayaran, pesanan tersimpan, dan antrean. Stok serta katalog tetap ada.',
        successMessage: 'Seluruh transaksi telah dihapus. Stok, katalog, shift, dan pengeluaran tetap tersimpan.',
    },
    {
        type: 'ALL',
        label: 'Reset Semua',
        phrase: 'RESET OUTLET',
        icon: 'delete-sweep-outline',
        description: 'Hapus seluruh data operasional termasuk transaksi, stok, katalog, pelanggan, shift, dan pengeluaran.',
        successMessage: 'Seluruh data operasional telah dibersihkan. Akun, lisensi, dan pengaturan tetap tersimpan.',
    },
];

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
    const { settings, setSettings, user } = useStore();
    const canManageBusinessSettings = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const isOwner = user?.role === 'OWNER';
    const licenseNumber = settings?.license_number || 'Belum tersinkron';
    const handleCopyLicenseNumber = () => {
        Clipboard.setString(licenseNumber);
        Alert.alert('Nomor Lisensi Disalin', `${licenseNumber} sudah disalin.`);
    };
    const [storeName, setStoreName] = useState<string>(settings?.storeName || 'LitePOS');
    const [storeAddress, setStoreAddress] = useState<string>(settings?.storeAddress || '');
    const [storePhone, setStorePhone] = useState<string>(settings?.storePhone || '');
    const [showImages, setShowImages] = useState<boolean>(settings?.showImages ?? true);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(settings?.theme === 'dark');
    const [storeLogo, setStoreLogo] = useState<string | null>(settings?.storeLogo || null);
    const [enablePreOrder, setEnablePreOrder] = useState<boolean>(settings?.enablePreOrder ?? false);
    const [enableShift, setEnableShift] = useState<boolean>(settings?.enableShift ?? true);
    const [enableShiftReminder, setEnableShiftReminder] = useState<boolean>(settings?.enableShiftReminder ?? true);
    const [shiftDurationHours, setShiftDurationHours] = useState<string>(String((Number(settings?.shiftDurationMinutes) || 480) / 60));
    const [shiftReminderMinutes, setShiftReminderMinutes] = useState<string>(String(settings?.shiftReminderMinutes ?? 15));
    const [shiftDayCutoff, setShiftDayCutoff] = useState<string>(settings?.shiftDayCutoff || '23:50');
    const [enableDineTable, setEnableDineTable] = useState<boolean>(settings?.enableDineTable ?? false);
    const [enableTableOrder, setEnableTableOrder] = useState<boolean>(settings?.enableTableOrder ?? false);
    const [enableKitchenPrint, setEnableKitchenPrint] = useState<boolean>(settings?.enableKitchenPrint ?? false);
    const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(settings?.allowNegativeStock ?? false);
    const [showLogoOnReceipt, setShowLogoOnReceipt] = useState<boolean>(settings?.showLogoOnReceipt ?? true);
    const [receiptFooter, setReceiptFooter] = useState<string>(settings?.receiptFooter || '');
    const [loyaltyActive, setLoyaltyActive] = useState<boolean>(settings?.loyalty_active ?? false);
    const [loyaltyMultiplier, setLoyaltyMultiplier] = useState<string>(String(settings?.loyalty_multiplier || '1'));
    const [loyaltyMultiplierAmount, setLoyaltyMultiplierAmount] = useState<string>(String(settings?.loyalty_multiplier_amount || '1000'));
    const [loyaltyPointValue, setLoyaltyPointValue] = useState<string>(String(settings?.loyalty_point_value || '0'));
    const [loyaltyMinPoints, setLoyaltyMinPoints] = useState<string>(String(settings?.loyalty_min_points || '0'));
    const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(settings?.google_sheet_url || '');
    const [apiBaseUrl, setApiBaseUrlInput] = useState<string>(settings?.apiBaseUrl || DEFAULT_API_URL);
    const [licenseCode, setLicenseCode] = useState('');
    const [isActivatingLicense, setIsActivatingLicense] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetType, setResetType] = useState<ResetType | null>(null);
    const [transactionResetMode, setTransactionResetMode] = useState<TransactionResetMode>('ALL');
    const [transactionStartDate, setTransactionStartDate] = useState('');
    const [transactionEndDate, setTransactionEndDate] = useState('');
    const [resetPassword, setResetPassword] = useState('');
    const [resetPhrase, setResetPhrase] = useState('');
    const [resetCountdown, setResetCountdown] = useState<number | null>(null);
    const [isResettingData, setIsResettingData] = useState(false);
    const selectedReset = RESET_OPTIONS.find(option => option.type === resetType) || null;
    const usesTransactionRange = resetType === 'TRANSACTIONS' && transactionResetMode === 'RANGE';
    const transactionRangeValid = !usesTransactionRange || (
        /^\d{4}-\d{2}-\d{2}$/.test(transactionStartDate)
        && /^\d{4}-\d{2}-\d{2}$/.test(transactionEndDate)
        && transactionStartDate <= transactionEndDate
    );
    const resetImpactDescription = usesTransactionRange
        ? `Hapus transaksi dari ${transactionStartDate || 'tanggal awal'} sampai ${transactionEndDate || 'tanggal akhir'}, termasuk pembayaran dan antrean terkait. Stok, katalog, shift, serta pengeluaran tetap ada.`
        : selectedReset?.description || '';
    const [, , setColorScheme] = useAppColorScheme(tw);
    const logoShotRef = useRef<any>(null);
    const isHydratingSettingsRef = useRef(true);
    const receiptLogoUri = resolveReceiptLogoUri(storeLogo, apiBaseUrl);

    // Printer state
    const [bleDevices, setBleDevices] = useState<any[]>([]);
    const [usbDevices, setUsbDevices] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [connectedPrinter, setConnectedPrinter] = useState<string | null>(null);
    const [printerType, setPrinterType] = useState<'BLE' | 'USB' | null>(null);
    const [activeTab, setActiveTab] = useState<'BLE' | 'USB'>('BLE');

    // Accordion state
    const [openSection, setOpenSection] = useState<string | null>(null);

    useEffect(() => { loadSettingsFromDB(); }, []);

    useEffect(() => {
        if (resetCountdown === null || resetCountdown <= 0) return;
        const timer = setTimeout(() => setResetCountdown(value => value === null ? null : value - 1), 1000);
        return () => clearTimeout(timer);
    }, [resetCountdown]);

    const toggleSection = (key: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenSection(openSection === key ? null : key);
    };

    const handleActivateLicense = async () => {
        if (!licenseCode.trim()) {
            Alert.alert('Kode Belum Diisi', 'Masukkan kode aktivasi outlet.');
            return;
        }
        setIsActivatingLicense(true);
        try {
            const license = await activateLicense(licenseCode);
            setSettings({ ...useStore.getState().settings, ...licenseToSettings(license) });
            setLicenseCode('');
            Alert.alert('Lisensi Aktif', 'Masa aktif outlet berhasil diperpanjang.');
        } catch (error: any) {
            Alert.alert('Aktivasi Gagal', error?.response?.data?.message || error?.message || 'Kode tidak dapat diproses.');
        } finally {
            setIsActivatingLicense(false);
        }
    };

    const closeResetModal = () => {
        if (isResettingData) return;
        setShowResetModal(false);
        setResetCountdown(null);
        setResetType(null);
        setTransactionResetMode('ALL');
        setTransactionStartDate('');
        setTransactionEndDate('');
        setResetPassword('');
        setResetPhrase('');
    };

    const performGlobalReset = async () => {
        setIsResettingData(true);
        try {
            const response = await api.post('/license/reset-data', {
                password: resetPassword,
                confirmation: resetPhrase.trim(),
                resetType,
                transactionMode: resetType === 'TRANSACTIONS' ? transactionResetMode : undefined,
                startDate: usesTransactionRange ? transactionStartDate : undefined,
                endDate: usesTransactionRange ? transactionEndDate : undefined,
            }, { timeout: 30000 });
            const resetState = response.data?.data?.resetState;
            const resetVersion = Number(resetState?.version);
            if (!Number.isInteger(resetVersion) || resetVersion < 1) {
                throw new Error('Server tidak mengembalikan versi reset yang valid.');
            }
            await clearOperationalLocalData(
                resetVersion,
                resetState?.resetAt || null,
                (resetState?.scope || resetType) as ResetType,
                resetState?.transactionRange
                    ? {
                        transactionResetAll: false,
                        transactionRanges: [{
                            startAt: String(resetState.transactionRange.startAt),
                            endAt: String(resetState.transactionRange.endAt),
                        }],
                    }
                    : { transactionResetAll: true }
            );
            if ((resetState?.scope || resetType) === 'ALL') {
                useStore.getState().setActiveShift(null);
            }
            useStore.getState().clearCart();
            setSettings({
                ...useStore.getState().settings,
                dataResetVersion: resetVersion,
                dataResetAt: resetState?.resetAt || new Date().toISOString(),
                dataResetType: resetState?.scope || resetType || '',
            });
            setShowResetModal(false);
            setResetCountdown(null);
            setResetType(null);
            setTransactionResetMode('ALL');
            setTransactionStartDate('');
            setTransactionEndDate('');
            setResetPassword('');
            setResetPhrase('');
            Alert.alert(
                'Reset Berhasil',
                usesTransactionRange
                    ? `Transaksi tanggal ${transactionStartDate} sampai ${transactionEndDate} telah dihapus. Stok, katalog, shift, dan pengeluaran tetap tersimpan.`
                    : selectedReset?.successMessage || 'Data berhasil direset.'
            );
        } catch (error: any) {
            setResetCountdown(null);
            setShowResetModal(true);
            Alert.alert(
                'Reset Gagal',
                error?.response?.data?.message || error?.message || 'Data tidak dapat direset.'
            );
        } finally {
            setIsResettingData(false);
        }
    };

    const confirmGlobalReset = () => {
        if (!selectedReset) {
            Alert.alert('Jenis Reset Belum Dipilih', 'Pilih reset stok, transaksi, atau semua data.');
            return;
        }
        if (!resetPassword || resetPhrase.trim() !== selectedReset.phrase) {
            Alert.alert('Konfirmasi Belum Lengkap', `Masukkan password Owner dan ketik ${selectedReset.phrase} dengan tepat.`);
            return;
        }
        if (!transactionRangeValid) {
            Alert.alert('Rentang Tanggal Belum Valid', 'Isi tanggal awal dan akhir dengan format YYYY-MM-DD. Tanggal akhir tidak boleh sebelum tanggal awal.');
            return;
        }
        Alert.alert(
            'Konfirmasi 1 dari 2',
            `${resetImpactDescription}\n\nPerubahan berlaku permanen di website dan seluruh Android. Lanjut ke konfirmasi akhir?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Lanjut',
                    style: 'destructive',
                    onPress: () => {
                        setShowResetModal(false);
                        setResetCountdown(10);
                    },
                },
            ]
        );
    };

    const loadSettingsFromDB = async () => {
        isHydratingSettingsRef.current = true;
        try {
            const db = await getDBConnection();
            const [results] = await db.executeSql('SELECT * FROM settings');
            const rawSettings: any = {};
            for (let i = 0; i < results.rows.length; i++) {
                const item = results.rows.item(i);
                rawSettings[item.key] = item.value;
            }
            const normalizedApiBaseUrl = await persistApiBaseUrl(rawSettings.apiBaseUrl || await getApiBaseUrl());
            const finalSettings = {
                ...settings,
                storeName: rawSettings.storeName || 'LitePOS',
                storeAddress: rawSettings.storeAddress || '',
                storePhone: rawSettings.storePhone || '',
                storeLogo: rawSettings.storeLogo || null,
                enablePreOrder: rawSettings.enablePreOrder === 'true',
                enableDineTable: rawSettings.enableDineTable === 'true',
                enableTableOrder: rawSettings.enableTableOrder === 'true',
                enableKitchenPrint: rawSettings.enableKitchenPrint === 'true',
                enableShift: rawSettings.enableShift === undefined ? true : rawSettings.enableShift === 'true',
                enableShiftReminder: rawSettings.enableShiftReminder === undefined ? true : rawSettings.enableShiftReminder === 'true',
                shiftDurationMinutes: Number(rawSettings.shiftDurationMinutes || 480),
                shiftReminderMinutes: Number(rawSettings.shiftReminderMinutes || 15),
                shiftDayCutoff: /^([01]\d|2[0-3]):[0-5]\d$/.test(rawSettings.shiftDayCutoff || '') ? rawSettings.shiftDayCutoff : '23:50',
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
                apiBaseUrl: normalizedApiBaseUrl,
                dataResetVersion: Number(rawSettings.dataResetVersion || 0),
                dataResetAt: rawSettings.dataResetAt || '',
                dataResetType: rawSettings.dataResetType || '',
            };
            setStoreName(finalSettings.storeName);
            setStoreAddress(finalSettings.storeAddress);
            setStorePhone(finalSettings.storePhone);
            setStoreLogo(finalSettings.storeLogo);
            setEnablePreOrder(finalSettings.enablePreOrder);
            setEnableShift(rawSettings.enableShift === undefined ? true : rawSettings.enableShift === 'true');
            setEnableShiftReminder(finalSettings.enableShiftReminder);
            setShiftDurationHours(String(finalSettings.shiftDurationMinutes / 60));
            setShiftReminderMinutes(String(finalSettings.shiftReminderMinutes));
            setShiftDayCutoff(finalSettings.shiftDayCutoff);
            setEnableDineTable(finalSettings.enableDineTable);
            setEnableTableOrder(finalSettings.enableTableOrder);
            setEnableKitchenPrint(finalSettings.enableKitchenPrint);
            setLoyaltyActive(finalSettings.loyalty_active);
            setLoyaltyMultiplier(String(finalSettings.loyalty_multiplier));
            setLoyaltyMultiplierAmount(String(finalSettings.loyalty_multiplier_amount));
            setLoyaltyPointValue(String(finalSettings.loyalty_point_value));
            setLoyaltyMinPoints(String(finalSettings.loyalty_min_points));
            setGoogleSheetUrl(finalSettings.google_sheet_url);
            setApiBaseUrlInput(finalSettings.apiBaseUrl);
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
        finally {
            setTimeout(() => { isHydratingSettingsRef.current = false; }, 0);
        }
    };

    const saveSettings = async () => {
        try {
            const db = await getDBConnection();
            const themeToSave = isDarkMode ? 'dark' : 'light';
            const normalizedApiBaseUrl = await persistApiBaseUrl(apiBaseUrl || DEFAULT_API_URL);
            const normalizedShiftDurationMinutes = Math.min(2880, Math.max(30, Math.round((Number(shiftDurationHours) || 8) * 60)));
            const normalizedShiftReminderMinutes = Math.min(240, Math.max(0, Math.round(Number(shiftReminderMinutes) || 0)));
            const normalizedShiftDayCutoff = /^([01]\d|2[0-3]):[0-5]\d$/.test(shiftDayCutoff) ? shiftDayCutoff : '23:50';
            const localSettingsToSave = [
                ['theme', themeToSave],
                ['enableKitchenPrint', enableKitchenPrint ? 'true' : 'false'],
                ['apiBaseUrl', normalizedApiBaseUrl],
            ];
            const businessSettingsToSave = [
                ['storeName', storeName],
                ['storeAddress', storeAddress],
                ['storePhone', storePhone],
                ['storeLogo', storeLogo || ''],
                ['enablePreOrder', enablePreOrder ? 'true' : 'false'],
                ['enableShift', enableShift ? 'true' : 'false'],
                ['enableShiftReminder', enableShiftReminder ? 'true' : 'false'],
                ['shiftDurationMinutes', String(normalizedShiftDurationMinutes)],
                ['shiftReminderMinutes', String(normalizedShiftReminderMinutes)],
                ['shiftDayCutoff', normalizedShiftDayCutoff],
                ['enableDineTable', enableDineTable ? 'true' : 'false'],
                ['enableTableOrder', enableTableOrder ? 'true' : 'false'],
                ['showImages', showImages ? 'true' : 'false'],
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

            for (const [key, value] of localSettingsToSave) {
                await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
            }

            let businessSettingsChanged = false;
            if (canManageBusinessSettings) {
                for (const [key, value] of businessSettingsToSave) {
                    const [existing] = await db.executeSql('SELECT value FROM settings WHERE key = ?', [key]);
                    const currentValue = existing.rows.length > 0 ? String(existing.rows.item(0).value ?? '') : null;
                    if (currentValue !== String(value ?? '')) businessSettingsChanged = true;
                    await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
                }
            }
            if (connectedPrinter && printerType) {
                await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('printerAddress', ?)`, [connectedPrinter]);
                await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('printerType', ?)`, [printerType]);
            }
            if (businessSettingsChanged) {
                await db.executeSql(
                    `INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_sync_pending', 'true')`
                );
            }

            const businessSettings = canManageBusinessSettings ? {
                storeName,
                storeAddress,
                storePhone,
                storeLogo,
                enablePreOrder,
                enableShift,
                enableShiftReminder,
                shiftDurationMinutes: normalizedShiftDurationMinutes,
                shiftReminderMinutes: normalizedShiftReminderMinutes,
                shiftDayCutoff: normalizedShiftDayCutoff,
                enableDineTable,
                enableTableOrder,
                showImages,
                allowNegativeStock,
                showLogoOnReceipt,
                receiptFooter,
                loyalty_active: loyaltyActive,
                loyalty_multiplier: Number(loyaltyMultiplier),
                loyalty_multiplier_amount: Number(loyaltyMultiplierAmount),
                loyalty_point_value: Number(loyaltyPointValue),
                loyalty_min_points: Number(loyaltyMinPoints),
                google_sheet_url: googleSheetUrl,
            } : {};
            setSettings({
                ...settings,
                ...businessSettings,
                enableKitchenPrint,
                printerAddress: connectedPrinter,
                printerType,
                theme: themeToSave,
                apiBaseUrl: normalizedApiBaseUrl,
            });
            setColorScheme(themeToSave);
        } catch (error) {
            console.error('Auto save error:', error);
        }
    };

    useEffect(() => {
        if (isHydratingSettingsRef.current) return;
        const timer = setTimeout(() => {
            saveSettings();
        }, 800);
        return () => clearTimeout(timer);
    }, [storeName, storeAddress, storePhone, storeLogo, enablePreOrder, enableShift, enableShiftReminder, shiftDurationHours, shiftReminderMinutes, shiftDayCutoff, enableDineTable, enableTableOrder, enableKitchenPrint, showImages, isDarkMode, allowNegativeStock, showLogoOnReceipt, receiptFooter, loyaltyActive, loyaltyMultiplier, loyaltyMultiplierAmount, loyaltyPointValue, loyaltyMinPoints, googleSheetUrl, apiBaseUrl, canManageBusinessSettings]);

    const persistBackendUrl = async (value: string = apiBaseUrl) => {
        const normalized = await persistApiBaseUrl(value || DEFAULT_API_URL);
        const db = await getDBConnection();
        await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('apiBaseUrl', ?)`, [normalized]);
        setApiBaseUrlInput(normalized);
        setSettings({ ...useStore.getState().settings, apiBaseUrl: normalized });
        return normalized;
    };

    const redirectToServerLogin = async () => {
        try { await api.post('/auth/logout'); } catch { /* server lama bisa tidak tersedia */ }
        await clearAuthSession();
        useStore.getState().setUser(null);
        const rootNavigation = navigation.getParent?.();
        if (rootNavigation) rootNavigation.replace('Login');
        else navigation.replace('Login');
    };

    const showServerLoginRequired = (serverUrl: string) => {
        Alert.alert(
            'Login Server Diperlukan',
            `Backend aktif di ${serverUrl}, tetapi sesi saat ini berasal dari server lain atau mode offline. Login ulang agar sinkronisasi aman.`,
            [
                { text: 'Nanti', style: 'cancel' },
                { text: 'Login Ulang', onPress: redirectToServerLogin },
            ]
        );
    };

    const handleTestApiConnection = async () => {
        try {
            const normalized = await persistBackendUrl();
            const res = await api.get('/health', { timeout: 5000 });
            const token = await getAuthToken();
            const sessionNote = !token || token === OFFLINE_SESSION_TOKEN
                ? '\nSesi server: login ulang diperlukan sebelum sinkronisasi.'
                : '\nSesi server: siap digunakan.';
            Alert.alert(
                'Koneksi Berhasil',
                `Backend aktif: ${normalized}\nDatabase: ${res.data?.database || 'UNKNOWN'}${sessionNote}`
            );
        } catch (e: any) {
            const message = e?.response?.data?.error || e?.message || 'Tidak bisa menghubungi backend.';
            Alert.alert('Koneksi Gagal', `${message}\n\nPastikan HP/PC berada di jaringan yang sama dan backend sedang berjalan.`);
        }
    };


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
    const getPrintableLogoBase64 = async (): Promise<string> => {
        if (storeLogo && logoShotRef.current?.capture) {
            try {
                const uri = await logoShotRef.current.capture();
                return await RNFS.readFile(uri.replace('file://', ''), 'base64');
            } catch (logoErr) {
                console.warn('Logo capture failed, using default logo:', logoErr);
            }
        }

        return RECEIPT_LOGO_BASE64;
    };

    const handleTestPrint = async () => {
        if (!connectedPrinter || !printerType) {
            Alert.alert('Info', 'Belum ada printer yang tersambung.');
            return;
        }

        try {
            const printerClass = await connectConfiguredPrinter({
                printerAddress: connectedPrinter,
                printerType,
            });

            // Print logo
            if (showLogoOnReceipt === true || String(showLogoOnReceipt) === 'true') {
                try {
                    const logoToPrint = await getPrintableLogoBase64();
                    await printerClass.printImageBase64(logoToPrint, getReceiptLogoPrintOptions());
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
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
                const addressLines = wrapText(settings.storeAddress, WIDTH);
                for (const line of addressLines) {
                    text += center(line, WIDTH) + '\n';
                }
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
                const footerLines = wrapText(settings.receiptFooter, WIDTH);
                for (const line of footerLines) {
                    text += center(line, WIDTH) + '\n';
                }
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

    const wrapText = (text: string, width: number): string[] => {
        const result: string[] = [];
        const paragraphs = text.split('\n');
        for (const paragraph of paragraphs) {
            if (paragraph.length <= width) {
                result.push(paragraph);
                continue;
            }
            const words = paragraph.split(' ');
            let currentLine = '';
            for (const word of words) {
                if (currentLine.length === 0) {
                    if (word.length > width) {
                        for (let i = 0; i < word.length; i += width) {
                            result.push(word.substring(i, i + width));
                        }
                    } else {
                        currentLine = word;
                    }
                } else if ((currentLine + ' ' + word).length <= width) {
                    currentLine += ' ' + word;
                } else {
                    result.push(currentLine);
                    if (word.length > width) {
                        for (let i = 0; i < word.length; i += width) {
                            result.push(word.substring(i, i + width));
                        }
                        currentLine = '';
                    } else {
                        currentLine = word;
                    }
                }
            }
            if (currentLine) result.push(currentLine);
        }
        return result;
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
            const printerId = `${device.vendor_id}|${device.product_id}`;
            await connectConfiguredPrinter({ printerAddress: printerId, printerType: 'USB' });
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
                                        for (const p of (data.products || [])) await db.executeSql('INSERT OR REPLACE INTO products (id, categoryId, name, price, costPrice, enableCostPrice, stock, imageUrl, isUnlimitedStock, barcode, minStock, discountActive, discountType, discountValue, discountStartAt, discountEndAt, discountStartTime, discountEndTime, discountDays, discountLabel) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [p.id, p.categoryId, p.name, p.price, p.costPrice || 0, p.enableCostPrice || 0, p.stock || 0, p.imageUrl || null, p.isUnlimitedStock || 0, p.barcode || null, p.minStock || 0, p.discountActive || 0, p.discountType || null, p.discountValue || 0, p.discountStartAt || null, p.discountEndAt || null, p.discountStartTime || null, p.discountEndTime || null, p.discountDays || null, p.discountLabel || null]);
                                        for (const u of (data.users || [])) await db.executeSql('INSERT OR REPLACE INTO users (id, name, email, username, pin, role) VALUES (?,?,?,?,?,?)', [u.id, u.name, u.email || null, u.username || null, u.pin, u.role || 'CASHIER']);
                                        for (const c of (data.customers || [])) await db.executeSql('INSERT OR REPLACE INTO customers (id, name, phone, notes, loyaltyDiscount) VALUES (?,?,?,?,?)', [c.id, c.name, c.phone || null, c.notes || null, c.loyaltyDiscount || 0]);
                                        for (const s of (data.suppliers || [])) await db.executeSql('INSERT OR REPLACE INTO suppliers (id, name, phone, address, notes) VALUES (?,?,?,?,?)', [s.id, s.name, s.phone || null, s.address || null, s.notes || null]);
                                        for (const p of (data.packages || [])) await db.executeSql('INSERT OR REPLACE INTO packages (id, name, description, price, isActive, createdAt) VALUES (?,?,?,?,?,?)', [p.id, p.name, p.description || null, p.price, p.isActive, p.createdAt]);
                                        for (const pi of (data.package_items || [])) await db.executeSql('INSERT OR REPLACE INTO package_items (id, packageId, productId, quantity) VALUES (?,?,?,?)', [pi.id, pi.packageId, pi.productId, pi.quantity]);
                                        for (const t of (data.transactions || [])) await db.executeSql('INSERT OR REPLACE INTO transactions (id, invoiceNumber, grandTotal, discountAmount, paymentMethod, cashAmount, changeAmount, customerId, customerName, createdAt, status, preOrderDate, paymentStatus, paidAmount, remainingAmount, paidAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [t.id, t.invoiceNumber, t.grandTotal, t.discountAmount || 0, t.paymentMethod, t.cashAmount || 0, t.changeAmount || 0, t.customerId || null, t.customerName || null, t.createdAt, t.status || 'COMPLETED', t.preOrderDate || null, t.paymentStatus || 'PAID', t.paymentStatus === 'UNPAID' ? 0 : (t.paidAmount || t.grandTotal || 0), t.remainingAmount || 0, t.paymentStatus === 'UNPAID' ? null : (t.paidAt || t.createdAt)]);
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

            {receiptLogoUri && showLogoOnReceipt ? (
                <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: -10000, width: RECEIPT_LOGO_CAPTURE_WIDTH, height: RECEIPT_LOGO_CAPTURE_HEIGHT }}>
                    <ViewShot
                        ref={logoShotRef}
                        options={{ format: 'png', quality: 1 }}
                        style={{
                            width: RECEIPT_LOGO_CAPTURE_WIDTH,
                            height: RECEIPT_LOGO_CAPTURE_HEIGHT,
                            padding: 10,
                            backgroundColor: '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Image
                            source={{ uri: receiptLogoUri }}
                            style={{ width: RECEIPT_LOGO_INNER_WIDTH, height: RECEIPT_LOGO_INNER_HEIGHT }}
                            resizeMode="contain"
                        />
                    </ViewShot>
                </View>
            ) : null}

            <ScrollView contentContainerStyle={tw`p-4 pb-10`}>
                {/* ── PROFIL TOKO ────────────────────────────────────────────────── */}
                {canManageBusinessSettings && (
                <SectionItem
                    icon="storefront-outline" iconColor={tw.color('blue-600')}
                    label="Profil Toko" sublabel="Nama, alamat, logo bisnis"
                    isOpen={openSection === 'profile'} onPress={() => toggleSection('profile')}
                >
                    <View style={tw`pt-4`}>
                        <View style={tw`bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 mb-4`}>
                            <Text style={tw`text-xs font-bold text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider`}>Lisensi Outlet</Text>
                            <View style={tw`flex-row items-center justify-between`}>
                                <Text selectable style={tw`flex-1 text-base font-black text-gray-800 dark:text-gray-100 tracking-widest`}>{licenseNumber}</Text>
                                <TouchableOpacity
                                    style={tw`ml-3 flex-row items-center bg-blue-600 px-3 py-2 rounded-lg`}
                                    onPress={handleCopyLicenseNumber}
                                    accessibilityRole="button"
                                    accessibilityLabel="Salin nomor lisensi"
                                >
                                    <Icon name="content-copy" size={15} color="white" style={tw`mr-1.5`} />
                                    <Text style={tw`text-white text-xs font-bold`}>Salin</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={tw`text-[10px] text-blue-700 dark:text-blue-300 mt-2`}>Status {settings?.license_status || 'UNKNOWN'} · Berlaku untuk website dan semua Android outlet.</Text>
                            {settings?.license_expire_date ? (
                                <Text style={tw`text-[10px] text-blue-700 dark:text-blue-300 mt-1`}>
                                    Berlaku sampai {new Date(settings.license_expire_date).toLocaleDateString('id-ID')}.
                                </Text>
                            ) : null}
                            {user?.role === 'OWNER' ? (
                                <View style={tw`mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/40`}>
                                    <TextInput
                                        value={licenseCode}
                                        onChangeText={(value) => setLicenseCode(value.toUpperCase())}
                                        placeholder="LP-XXXX-XXXX-XXXX-XXXX-XXXX"
                                        placeholderTextColor={tw.color('gray-400')}
                                        autoCapitalize="characters"
                                        style={tw`bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white font-bold tracking-wider`}
                                    />
                                    <TouchableOpacity
                                        onPress={handleActivateLicense}
                                        disabled={isActivatingLicense}
                                        style={tw`bg-blue-600 rounded-xl py-3 items-center mt-2 ${isActivatingLicense ? 'opacity-60' : ''}`}
                                    >
                                        <Text style={tw`text-white font-black`}>{isActivatingLicense ? 'Memproses...' : 'Aktifkan / Perpanjang'}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                        </View>

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
                            {receiptLogoUri ? (
                                <View style={tw`w-24 h-16 rounded-xl mr-4 border border-gray-200 bg-white items-center justify-center overflow-hidden`}>
                                    <Image source={{ uri: receiptLogoUri }} style={{ width: 88, height: 56 }} resizeMode="contain" />
                                </View>
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
                                {storeLogo && (
                                    <TouchableOpacity
                                        onPress={() => Alert.alert('Hapus Logo', 'Logo toko akan dihapus dari struk. Lanjutkan?', [
                                            { text: 'Batal', style: 'cancel' },
                                            { text: 'Hapus', style: 'destructive', onPress: () => setStoreLogo(null) },
                                        ])}
                                    >
                                        <Text style={tw`text-red-400 text-xs font-bold`}>Hapus Logo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        
                        <View style={tw`flex-row justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-xl mb-4 border border-gray-100 dark:border-gray-800`}>
                            <View>
                                <Text style={tw`text-sm font-bold text-gray-800 dark:text-gray-100`}>Tampilkan Logo di Struk</Text>
                                <Text style={tw`text-xs text-gray-500 dark:text-gray-400`}>Cetak logo toko pada bagian atas struk</Text>
                            </View>
                            <Switch value={showLogoOnReceipt} onValueChange={setShowLogoOnReceipt} trackColor={{ false: '#d1d5db', true: '#93c5fd' }} thumbColor={showLogoOnReceipt ? '#2563eb' : '#f3f4f6'} />
                        </View>

                        <Text style={tw`text-xs font-bold text-gray-500 mb-1 mt-3`}>Footer Struk (Kalimat Penutup)</Text>
                        <TextInput style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-1`}
                            value={receiptFooter} onChangeText={setReceiptFooter} placeholder="Contoh: Terima kasih telah berbelanja!" multiline />
                        <Text style={tw`text-[10px] text-gray-400 mb-2`}>Teks ini akan tampil di bagian bawah struk</Text>
                    </View>
                </SectionItem>
                )}

                {/* ── FITUR TOKO ─────────────────────────────────────────────────── */}
                {canManageBusinessSettings && (
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

                        {enableShift && (
                            <View style={tw`mb-4 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4`}>
                                <View style={tw`flex-row items-center justify-between mb-3`}>
                                    <View style={tw`flex-1 mr-4`}>
                                        <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Pengingat Closing</Text>
                                        <Text style={tw`text-gray-500 text-xs mt-0.5`}>Alert sebelum target tutup dan pergantian hari</Text>
                                    </View>
                                    <Switch value={enableShiftReminder} onValueChange={setEnableShiftReminder} trackColor={{ false: '#d1d5db', true: '#93c5fd' }} thumbColor={enableShiftReminder ? '#2563eb' : '#f3f4f6'} />
                                </View>
                                {enableShiftReminder && (
                                    <View>
                                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5`}>Durasi shift (jam)</Text>
                                        <TextInput
                                            value={shiftDurationHours}
                                            onChangeText={value => setShiftDurationHours(value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                                            keyboardType="decimal-pad"
                                            placeholder="8"
                                            placeholderTextColor={tw.color('gray-400')}
                                            style={tw`bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-100 mb-3`}
                                        />
                                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5`}>Ingatkan sebelumnya (menit)</Text>
                                        <TextInput
                                            value={shiftReminderMinutes}
                                            onChangeText={value => setShiftReminderMinutes(value.replace(/[^0-9]/g, ''))}
                                            keyboardType="number-pad"
                                            placeholder="15"
                                            placeholderTextColor={tw.color('gray-400')}
                                            style={tw`bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-100 mb-3`}
                                        />
                                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5`}>Jam peringatan pergantian hari (HH:MM)</Text>
                                        <TextInput
                                            value={shiftDayCutoff}
                                            onChangeText={setShiftDayCutoff}
                                            keyboardType="numbers-and-punctuation"
                                            maxLength={5}
                                            placeholder="23:50"
                                            placeholderTextColor={tw.color('gray-400')}
                                            style={tw`bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2.5 text-gray-800 dark:text-gray-100`}
                                        />
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Dine Table */}
                        <View style={tw`flex-row items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800`}>
                            <View style={tw`flex-1 mr-4`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Icon name="silverware-fork-knife" size={14} color={tw.color('green-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Manajemen Meja</Text>
                                </View>
                                <Text style={tw`text-gray-500 text-xs`}>Kelola meja dine-in (restoran, kafe)</Text>
                            </View>
                            <Switch
                                value={enableDineTable}
                                onValueChange={(value) => {
                                    setEnableDineTable(value);
                                    if (!value) setEnableTableOrder(false);
                                }}
                                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                                thumbColor={enableDineTable ? '#16a34a' : '#f3f4f6'}
                            />
                        </View>

                        {/* Table Order */}
                        <View style={tw`flex-row items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800`}>
                            <View style={tw`flex-1 mr-4`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Icon name="qrcode-scan" size={14} color={tw.color('emerald-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Order Meja via QR</Text>
                                </View>
                                <Text style={tw`text-gray-500 text-xs`}>Terima order pembeli dari QR meja</Text>
                            </View>
                            <Switch
                                value={enableTableOrder}
                                onValueChange={(value) => {
                                    setEnableTableOrder(value);
                                    if (value) setEnableDineTable(true);
                                }}
                                trackColor={{ false: '#d1d5db', true: '#6ee7b7' }}
                                thumbColor={enableTableOrder ? '#059669' : '#f3f4f6'}
                            />
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
                )}

                {/* ── POIN LOYALITAS ──────────────────────────────────────────────── */}
                {canManageBusinessSettings && (
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
                )}

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
                        <View style={tw`flex-row rounded-xl bg-gray-100 dark:bg-gray-900 p-1 mb-4`}>
                            {(['BLE', 'USB'] as const).map(type => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setActiveTab(type)}
                                    style={tw`flex-1 items-center rounded-lg py-2.5 ${activeTab === type ? 'bg-white dark:bg-gray-700' : ''}`}
                                >
                                    <Text style={tw`text-xs font-black ${activeTab === type ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500'}`}>
                                        {type === 'BLE' ? 'Bluetooth' : 'USB / OTG'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={tw`flex-row items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-800`}>
                            <View style={tw`flex-1 mr-4`}>
                                <View style={tw`flex-row items-center mb-1`}>
                                    <Icon name="chef-hat" size={16} color={tw.color('orange-600')} style={tw`mr-2`} />
                                    <Text style={tw`text-gray-800 dark:text-gray-100 font-bold`}>Aktifkan Cetak Dapur</Text>
                                </View>
                                <Text style={tw`text-gray-500 text-xs`}>Tampilkan tombol tiket dapur di layar kasir</Text>
                            </View>
                            <Switch
                                value={enableKitchenPrint}
                                onValueChange={setEnableKitchenPrint}
                                trackColor={{ false: '#d1d5db', true: '#fdba74' }}
                                thumbColor={enableKitchenPrint ? '#ea580c' : '#f3f4f6'}
                            />
                        </View>
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
                {isOwner && (
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
                )}

                {/* ── BACKUP & RESTORE ──────────────────────────────────────────── */}
                {isOwner && (
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
                        <TouchableOpacity
                            style={tw`bg-red-50 border border-red-300 py-3 rounded-xl flex-row justify-center items-center`}
                            onPress={() => setShowResetModal(true)}
                        >
                            <Icon name="delete-outline" size={16} color={tw.color('red-600')} style={tw`mr-2`} />
                            <Text style={tw`font-bold text-red-600`}>Pilih Data untuk Direset</Text>
                        </TouchableOpacity>
                        <View style={tw`flex-row items-center justify-center mt-3`}>
                            <Icon name="alert" size={11} color={tw.color('gray-400')} style={tw`mr-1`} />
                            <Text style={tw`text-[10px] text-gray-400 italic`}>Reset berlaku ke website dan seluruh Android; koneksi internet wajib aktif</Text>
                        </View>
                    </View>
                </SectionItem>
                )}

                {/* ✨ INTEGRASI LAPORAN ✨ */}
                {canManageBusinessSettings && (
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
                )}

                {/* ── SINKRONISASI ────────────────────────────────────────────────── */}
                {canManageBusinessSettings && (
                <SectionItem
                    icon="refresh" iconColor={tw.color('blue-500')}
                    label="Sinkronisasi Server" sublabel="Tarik/Dorong data ke Web"
                    isOpen={openSection === 'sync'} onPress={() => toggleSection('sync')}
                >
                    <View style={tw`pt-4`}>
                        <Text style={tw`text-gray-500 text-sm mb-4`}>
                            Sinkronisasi data Master (Produk, Kategori) dari Server, dan dorong sisa Transaksi Lokal ke Server.
                        </Text>
                        <View style={tw`mb-4`}>
                            <Text style={tw`text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider ml-1`}>URL Backend / API</Text>
                            <TextInput
                                style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-xl px-4 py-3 font-medium`}
                                placeholder="http://192.168.1.10:5000"
                                placeholderTextColor={tw.color('gray-400')}
                                value={apiBaseUrl}
                                onChangeText={setApiBaseUrlInput}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                            />
                            <Text style={tw`text-[10px] text-gray-400 mt-1 ml-1`}>
                                Isi alamat backend saja. Jika menulis /api di akhir, aplikasi akan menyesuaikan otomatis.
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={tw`bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3 rounded-xl flex-row justify-center items-center mb-2`}
                            onPress={handleTestApiConnection}
                        >
                            <Icon name="lan-connect" size={16} color={tw.color('blue-600')} style={tw`mr-2`} />
                            <Text style={tw`font-bold text-blue-700 dark:text-blue-300`}>Tes Koneksi Backend</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={tw`bg-blue-600 py-3.5 rounded-xl flex-row justify-center items-center mb-2`}
                            onPress={async () => {
                                const normalizedApiBaseUrl = await persistBackendUrl();
                                const serverToken = await getAuthToken();
                                if (!serverToken || serverToken === OFFLINE_SESSION_TOKEN) {
                                    showServerLoginRequired(normalizedApiBaseUrl);
                                    return;
                                }
                                Alert.alert('Sinkronisasi', `Mulai sinkronisasi data dengan server?\n\nServer: ${normalizedApiBaseUrl}`, [
                                    { text: 'Batal', style: 'cancel' },
                                    {
                                        text: 'Ya, Sinkron',
                                        onPress: async () => {
                                            try {
                                                const resetRes: any = await syncService.reconcileResetState();
                                                if (!resetRes.success) {
                                                    Alert.alert('Sinkronisasi Ditunda', resetRes.error || 'Status reset outlet gagal diperiksa.');
                                                    return;
                                                }
                                                if (resetRes.resetApplied) {
                                                    if (resetRes.scopes?.includes('ALL')) {
                                                        useStore.getState().setActiveShift(null);
                                                    }
                                                    useStore.getState().clearCart();
                                                }
                                                // 1. Dorong perubahan lokal sebelum menarik data server.
                                                console.log('[SYNC] Starting pushLocalData...');
                                                let pushRes: any = await syncService.pushLocalData();
                                                console.log('[SYNC] pushLocalData result:', pushRes);
                                                if (!pushRes.success) {
                                                    if (pushRes.status === 401 || pushRes.status === 403) {
                                                        showServerLoginRequired(normalizedApiBaseUrl);
                                                        return;
                                                    }
                                                    Alert.alert(
                                                        'Peringatan',
                                                        `Data lokal gagal dikirim. Data server belum ditarik agar perubahan lokal tidak tertimpa.\n\n${pushRes.error || 'Alasan tidak diketahui.'}`
                                                    );
                                                    return;
                                                }
                                                // 2. Ambil data master setelah perubahan lokal diterima server.
                                                console.log('[SYNC] Starting syncMasterData...');
                                                const masterRes = await syncService.syncMasterData();
                                                console.log('[SYNC] syncMasterData result:', masterRes);
                                                if (!masterRes.success) {
                                                    if (masterRes.status === 401 || masterRes.status === 403) {
                                                        showServerLoginRequired(normalizedApiBaseUrl);
                                                        return;
                                                    }
                                                    Alert.alert('Gagal', 'Data lokal terkirim, tetapi gagal menarik data master: ' + JSON.stringify(masterRes.error || 'Unknown error'));
                                                    return;
                                                }
                                                if (pushRes.requiresMasterSync) {
                                                    pushRes = await syncService.pushLocalData();
                                                    if (!pushRes.success) {
                                                        Alert.alert('Peringatan', `Data master berhasil ditarik, tetapi data lokal gagal dikirim.\n\n${pushRes.error || 'Alasan tidak diketahui.'}`);
                                                        return;
                                                    }
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
                                                        if (['showImages', 'enablePreOrder', 'enableShift', 'enableShiftReminder', 'enableDineTable', 'enableTableOrder', 'allowNegativeStock', 'loyalty_active', 'enableKitchenPrint'].includes(row.key)) {
                                                            reloadedSettings[row.key] = row.value === 'true';
                                                        } else if (['shiftDurationMinutes', 'shiftReminderMinutes', 'loyalty_multiplier', 'loyalty_multiplier_amount', 'loyalty_point_value', 'loyalty_min_points', 'dataResetVersion'].includes(row.key)) {
                                                            reloadedSettings[row.key] = Number(row.value || 0);
                                                        } else {
                                                            reloadedSettings[row.key] = row.value || null;
                                                        }
                                                    }
                                                    useStore.getState().setSettings(reloadedSettings);
                                                } catch (e) { console.warn('Gagal reload settings setelah sync:', e); }
                                                if (pushRes.warnings?.length > 0) {
                                                    const warningSummary = pushRes.warnings
                                                        .slice(0, 3)
                                                        .map((warning: any) => `${warning.entity}: ${warning.message}`)
                                                        .join('\n');
                                                    Alert.alert(
                                                        'Sinkronisasi Sebagian',
                                                        `Data utama sudah tersinkron. ${pushRes.warnings.length} data lokal belum dapat dikirim dan akan dicoba lagi.\n\n${warningSummary}`
                                                    );
                                                    return;
                                                }
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
                )}

                {/* ── TENTANG APLIKASI ──────────────────────────────────────────── */}
                <SectionItem
                    icon="information-outline" iconColor={tw.color('gray-500')}
                    label="Tentang Aplikasi" sublabel="LitePOS v3.1.0"
                    isOpen={openSection === 'about'} onPress={() => toggleSection('about')}
                >
                    <View style={tw`pt-4 items-center`}>
                        <Text style={tw`text-2xl font-black text-gray-800 dark:text-gray-100 mb-1`}>LitePOS</Text>
                        <Text style={tw`text-gray-500 text-sm mb-3`}>Versi 3.1.0</Text>
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

            <Modal
                visible={showResetModal}
                transparent
                animationType="fade"
                onRequestClose={closeResetModal}
            >
                <View style={tw`flex-1 bg-black/60 justify-center px-5`}>
                    <ScrollView
                        style={[tw`bg-white dark:bg-gray-800 rounded-3xl`, { maxHeight: '90%' }]}
                        contentContainerStyle={tw`p-6`}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={tw`w-12 h-12 rounded-2xl bg-red-100 items-center justify-center mb-4`}>
                            <Icon name="alert-octagon-outline" size={25} color={tw.color('red-600')} />
                        </View>
                        <Text style={tw`text-xl font-black text-gray-900 dark:text-white`}>Pilih data yang akan direset</Text>
                        <Text style={tw`text-sm text-gray-500 dark:text-gray-400 mt-2 leading-5`}>
                            Reset berlaku ke website dan seluruh Android. Data yang sudah dihapus tidak dapat dikembalikan.
                        </Text>

                        <View style={tw`mt-4`}>
                            {RESET_OPTIONS.map(option => {
                                const selected = resetType === option.type;
                                return (
                                    <TouchableOpacity
                                        key={option.type}
                                        style={tw`${selected ? 'bg-red-50 border-red-500' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'} border rounded-2xl p-3 mb-2 flex-row items-start`}
                                        onPress={() => {
                                            setResetType(option.type);
                                            setResetPhrase('');
                                            if (option.type !== 'TRANSACTIONS') {
                                                setTransactionResetMode('ALL');
                                                setTransactionStartDate('');
                                                setTransactionEndDate('');
                                            }
                                        }}
                                        disabled={isResettingData}
                                    >
                                        <View style={tw`${selected ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'} w-10 h-10 rounded-xl items-center justify-center mr-3`}>
                                            <Icon name={option.icon} size={20} color={selected ? 'white' : tw.color('gray-600')} />
                                        </View>
                                        <View style={tw`flex-1`}>
                                            <Text style={tw`font-black text-gray-900 dark:text-white`}>{option.label}</Text>
                                            <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-1 leading-4`}>{option.description}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {resetType === 'TRANSACTIONS' && (
                            <View style={tw`mt-3 bg-amber-50 dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-2xl p-4`}>
                                <Text style={tw`text-xs font-black text-gray-700 dark:text-gray-200 mb-3`}>CAKUPAN TRANSAKSI</Text>
                                <View style={tw`flex-row gap-2`}>
                                    {([
                                        ['ALL', 'Semua transaksi'],
                                        ['RANGE', 'Rentang tanggal'],
                                    ] as Array<[TransactionResetMode, string]>).map(([mode, label]) => (
                                        <TouchableOpacity
                                            key={mode}
                                            style={tw`${transactionResetMode === mode ? 'bg-white dark:bg-gray-800 border-amber-500' : 'border-amber-200 dark:border-gray-700'} flex-1 border rounded-xl px-3 py-3 items-center`}
                                            onPress={() => setTransactionResetMode(mode)}
                                            disabled={isResettingData}
                                        >
                                            <Text style={tw`${transactionResetMode === mode ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500'} text-xs font-bold text-center`}>{label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {usesTransactionRange && (
                                    <View style={tw`mt-4`}>
                                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-2`}>Dari tanggal (YYYY-MM-DD)</Text>
                                        <TextInput
                                            style={tw`bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white`}
                                            value={transactionStartDate}
                                            onChangeText={setTransactionStartDate}
                                            placeholder="2026-08-01"
                                            placeholderTextColor={tw.color('gray-400')}
                                            keyboardType="numbers-and-punctuation"
                                            maxLength={10}
                                            editable={!isResettingData}
                                        />
                                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mt-3 mb-2`}>Sampai tanggal (YYYY-MM-DD)</Text>
                                        <TextInput
                                            style={tw`bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white`}
                                            value={transactionEndDate}
                                            onChangeText={setTransactionEndDate}
                                            placeholder="2026-08-15"
                                            placeholderTextColor={tw.color('gray-400')}
                                            keyboardType="numbers-and-punctuation"
                                            maxLength={10}
                                            editable={!isResettingData}
                                        />
                                    </View>
                                )}
                                <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-3 leading-4`}>{resetImpactDescription}</Text>
                            </View>
                        )}

                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mt-5 mb-2`}>Password Owner</Text>
                        <TextInput
                            style={tw`border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white`}
                            value={resetPassword}
                            onChangeText={setResetPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            placeholder="Masukkan password"
                            placeholderTextColor={tw.color('gray-400')}
                            editable={!isResettingData && Boolean(selectedReset)}
                        />

                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mt-4 mb-2`}>
                            Ketik {selectedReset?.phrase || 'pilih jenis reset dahulu'}
                        </Text>
                        <TextInput
                            style={tw`border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-bold`}
                            value={resetPhrase}
                            onChangeText={setResetPhrase}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            placeholder={selectedReset?.phrase || 'Pilih jenis reset'}
                            placeholderTextColor={tw.color('gray-400')}
                            editable={!isResettingData && Boolean(selectedReset)}
                        />

                        <View style={tw`flex-row gap-3 mt-6`}>
                            <TouchableOpacity
                                style={tw`flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-700 items-center`}
                                onPress={closeResetModal}
                                disabled={isResettingData}
                            >
                                <Text style={tw`font-bold text-gray-700 dark:text-gray-200`}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={tw`flex-1 py-3.5 rounded-xl bg-red-600 items-center flex-row justify-center ${isResettingData ? 'opacity-60' : ''}`}
                                onPress={confirmGlobalReset}
                                disabled={isResettingData || !selectedReset || !transactionRangeValid || !resetPassword || resetPhrase.trim() !== selectedReset.phrase}
                            >
                                {isResettingData
                                    ? <ActivityIndicator size="small" color="white" style={tw`mr-2`} />
                                    : <Icon name="delete-forever-outline" size={17} color="white" style={tw`mr-2`} />}
                                <Text style={tw`font-bold text-white`}>{isResettingData ? 'Mereset...' : selectedReset?.label || 'Lanjutkan'}</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            <Modal
                visible={resetCountdown !== null}
                transparent
                animationType="fade"
                onRequestClose={closeResetModal}
            >
                <View style={tw`flex-1 bg-black/70 justify-center px-5`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-3xl p-6 items-center`}>
                        <View style={tw`w-14 h-14 rounded-2xl bg-red-100 items-center justify-center mb-4`}>
                            <Icon name="timer-alert-outline" size={29} color={tw.color('red-600')} />
                        </View>
                        <Text style={tw`text-xl font-black text-gray-900 dark:text-white text-center`}>Konfirmasi terakhir</Text>
                        <Text style={tw`text-sm text-gray-500 dark:text-gray-400 mt-2 leading-5 text-center`}>
                            {resetImpactDescription}
                        </Text>

                        <View style={tw`w-24 h-24 rounded-full bg-red-50 dark:bg-red-950 border-4 border-red-200 dark:border-red-800 items-center justify-center mt-6`}>
                            {isResettingData
                                ? <ActivityIndicator size="large" color={tw.color('red-600')} />
                                : <Text style={tw`text-4xl font-black text-red-600`}>{resetCountdown || 0}</Text>}
                        </View>
                        <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-3 text-center`}>
                            {isResettingData
                                ? 'Reset sedang diproses. Jangan tutup aplikasi.'
                                : resetCountdown && resetCountdown > 0
                                    ? 'Tombol reset aktif setelah hitung mundur selesai.'
                                    : 'Waktu berpikir selesai. Anda masih dapat membatalkan.'}
                        </Text>

                        <View style={tw`flex-row gap-3 mt-6 w-full`}>
                            <TouchableOpacity
                                style={tw`flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-700 items-center`}
                                onPress={closeResetModal}
                                disabled={isResettingData}
                            >
                                <Text style={tw`font-bold text-gray-700 dark:text-gray-200`}>Batalkan Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={tw`flex-1 py-3.5 rounded-xl bg-red-600 items-center justify-center ${isResettingData || resetCountdown !== 0 ? 'opacity-50' : ''}`}
                                onPress={performGlobalReset}
                                disabled={isResettingData || resetCountdown !== 0}
                            >
                                <Text style={tw`font-bold text-white`}>
                                    {isResettingData ? 'Memproses...' : selectedReset?.label || 'Reset Sekarang'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
