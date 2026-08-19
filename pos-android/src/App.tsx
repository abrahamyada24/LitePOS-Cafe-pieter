import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createNavigationContainerRef, NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppState, View, Text, TouchableOpacity, Alert, TextInput, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { getDBConnection, createTables, seedInitialData } from './database/db';
import tw, { useAppColorScheme } from 'twrnc';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from './store/useStore';
import { syncService } from './services/syncService';
import api, { hydrateApiBaseUrl, setApiBaseUrl as persistApiBaseUrl } from './services/api';
import { openCashierShift } from './services/shiftService';
import {
    AUTH_INACTIVITY_TIMEOUT_HOURS,
    AUTH_INACTIVITY_TIMEOUT_MS,
    clearAuthSession,
    getLastAuthActivity,
    markAuthActivity,
} from './services/secureAuthStorage';
import { licenseToSettings, resolveLicenseStatus } from './services/licenseService';
import {
    formatShiftDateTime,
    getOpeningExpectedCloseAt,
    getShiftReminder,
} from './utils/shiftReminder';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import POSScreen from './screens/POSScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import ReceiptPreviewScreen from './screens/ReceiptPreviewScreen';
import ManagementScreen from './screens/ManagementScreen';
import ReportScreen from './screens/ReportScreen';
import SettingsScreen from './screens/SettingsScreen';
import UserManagementScreen from './screens/UserManagementScreen';
import StockReceivingScreen from './screens/StockReceivingScreen';
import StockOpnameScreen from './screens/StockOpnameScreen';
import StockHistoryScreen from './screens/StockHistoryScreen';
import TableManagementScreen from './screens/TableManagementScreen';
import TableOrdersScreen from './screens/TableOrdersScreen';
import InventoryScreen from './screens/InventoryScreen';
import ContactScreen from './screens/ContactScreen';
import PackageScreen from './screens/PackageScreen';
import ProductListScreen from './screens/ProductListScreen';
import CategoryListScreen from './screens/CategoryListScreen';
import LockScreen from './screens/LockScreen';
import AppDialogProvider from './components/AppDialogProvider';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<any>();

// Ã¢â€â‚¬Ã¢â€â‚¬ Guard: block POS when shift not open Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function ShiftGuardedPOS({ navigation, route }: any) {
    useAppColorScheme(tw);
    const activeShift = useStore((state) => state.activeShift);
    const settings = useStore((state) => state.settings);
    const user = useStore((state) => state.user);
    const setActiveShift = useStore((state) => state.setActiveShift);
    const [openingCashInput, setOpeningCashInput] = useState('');
    const [isOpeningShift, setIsOpeningShift] = useState(false);

    const handleOpenShift = () => {
        if (isOpeningShift) return;
        const openingCash = Number(openingCashInput.replace(/[^0-9]/g, '') || '0');
        const expectedCloseAt = getOpeningExpectedCloseAt(settings);
        Alert.alert(
            'Konfirmasi Buka Shift',
            `Kas awal: Rp ${openingCash.toLocaleString('id-ID')}\nTarget tutup: ${formatShiftDateTime(expectedCloseAt)}\n\nPastikan nominal kas awal sudah benar.`,
            [
                { text: 'Ubah Nominal', style: 'cancel' },
                {
                    text: 'Ya, Buka Shift',
                    onPress: async () => {
                        setIsOpeningShift(true);
                        try {
                            const shift = await openCashierShift(user, openingCash, settings);
                            setActiveShift(shift);
                        } catch (error: any) {
                            console.error('Open shift from POS failed:', error);
                            Alert.alert(
                                'Gagal Membuka Shift',
                                error?.response?.data?.message || error?.message || 'Shift belum dapat dibuka. Silakan coba lagi.'
                            );
                        } finally {
                            setIsOpeningShift(false);
                        }
                    },
                },
            ]
        );
    };

    // If shift feature is disabled in settings, or shift is active Ã¢â€ â€™ open POS
    if (!settings.enableShift || activeShift) return <POSScreen navigation={navigation} route={route} />;

    return (
        <KeyboardAvoidingView
            style={tw`flex-1 bg-gray-50 dark:bg-gray-950`}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={tw`flex-grow justify-center px-6 py-10`}
                keyboardShouldPersistTaps="handled"
            >
                <View style={tw`w-full max-w-lg self-center`}>
                    <View style={tw`flex-row items-center mb-6`}>
                        <View style={tw`w-11 h-11 bg-blue-50 dark:bg-blue-900/30 rounded-xl items-center justify-center mr-3`}>
                            <Icon name="briefcase-outline" size={22} color={tw.color('blue-600')} />
                        </View>
                        <View>
                            <Text style={tw`text-[10px] font-black text-blue-600 uppercase`}>Shift Kasir</Text>
                            <Text style={tw`text-sm font-bold text-gray-500 dark:text-gray-400`}>{user?.name || 'Kasir'}</Text>
                        </View>
                    </View>

                    <Text style={tw`text-2xl font-black text-gray-900 dark:text-white mb-2`}>
                        Buka shift untuk mulai berjualan
                    </Text>
                    <Text style={tw`text-sm text-gray-500 dark:text-gray-400 leading-5 mb-7`}>
                        Masukkan uang tunai yang tersedia di laci kasir saat ini.
                    </Text>

                    <View style={tw`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5`}>
                        <Text style={tw`text-xs font-black text-gray-700 dark:text-gray-200 mb-2`}>Kas awal</Text>
                        <View style={tw`h-14 flex-row items-center border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 px-4 mb-3`}>
                            <Text style={tw`font-black text-gray-500 mr-3`}>Rp</Text>
                            <TextInput
                                style={tw`flex-1 text-lg font-black text-gray-900 dark:text-white py-0`}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={tw.color('gray-400')}
                                value={openingCashInput ? Number(openingCashInput).toLocaleString('id-ID') : ''}
                                onChangeText={value => setOpeningCashInput(value.replace(/[^0-9]/g, ''))}
                                returnKeyType="done"
                                onSubmitEditing={handleOpenShift}
                            />
                        </View>
                        <View style={tw`flex-row items-center mb-5`}>
                            <Icon name="information-outline" size={15} color={tw.color('gray-400')} />
                            <Text style={tw`text-[11px] text-gray-400 ml-1.5 flex-1`}>
                                Boleh Rp0 jika kosong. Target tutup {formatShiftDateTime(getOpeningExpectedCloseAt(settings))}.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={tw`h-14 bg-blue-600 rounded-lg flex-row items-center justify-center ${isOpeningShift ? 'opacity-60' : ''}`}
                            disabled={isOpeningShift}
                            onPress={handleOpenShift}
                        >
                            <Icon name="play" size={17} color="white" style={tw`mr-2`} />
                            <Text style={tw`text-white font-black`}>{isOpeningShift ? 'Membuka Shift...' : 'Buka Shift dan Masuk POS'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Main Tab Navigator Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function MainTabNavigator() {
    useAppColorScheme(tw);
    const user = useStore((state) => state.user);
    const role = user?.role || 'CASHIER';

    const normalizedRole = role.toUpperCase();
    console.log('Current User Role:', normalizedRole);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size }) => {
                    if (route.name === 'Beranda') return <Icon name="home" size={size} color={color} />;
                    if (route.name === 'Inventori') return <Icon name="package-variant" size={size} color={color} />;
                    if (route.name === 'Laporan') return <Icon name="file-document-outline" size={size} color={color} />;
                    if (route.name === 'Kontak') return <Icon name="account-box-outline" size={size} color={color} />;
                    if (route.name === 'Pengaturan') return <Icon name="cog-outline" size={size} color={color} />;
                    return <Icon name="home" size={size} color={color} />;
                },
                tabBarActiveTintColor: tw.color('blue-600'),
                tabBarInactiveTintColor: tw.color('gray-400'),
                tabBarStyle: tw`bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 h-16 pb-2 pt-2`,
                tabBarLabelStyle: tw`font-bold text-xs`,
            })}
        >
            <Tab.Screen name="Beranda" component={DashboardScreen} />
            {(normalizedRole === 'ADMIN' || normalizedRole === 'OWNER') && (
                <>
                    <Tab.Screen name="Inventori" component={InventoryScreen} />
                    <Tab.Screen name="Laporan" component={ReportScreen} />
                    <Tab.Screen name="Kontak" component={ContactScreen} />
                </>
            )}
            <Tab.Screen name="Pengaturan" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ App Root Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function App(): React.JSX.Element {
    const settings = useStore((state) => state.settings);
    const setSettings = useStore((state) => state.setSettings);
    const user = useStore((state) => state.user);
    const setUser = useStore((state) => state.setUser);
    const activeShift = useStore((state) => state.activeShift);
    const setActiveShift = useStore((state) => state.setActiveShift);
    const [colorScheme, , setColorScheme] = useAppColorScheme(tw);
    const lastInteractionRef = useRef(Date.now());
    const lastActivityWriteRef = useRef(0);
    const timeoutHandledRef = useRef(false);
    const shiftReminderGateRef = useRef({ key: '', nextAt: 0 });

    const expireInactiveSession = useCallback(async () => {
        if (!useStore.getState().user || timeoutHandledRef.current) return;
        timeoutHandledRef.current = true;
        try {
            await api.post('/auth/logout');
        } catch { /* sesi server mungkin sudah kedaluwarsa atau perangkat offline */ }
        await clearAuthSession();
        setUser(null);
        setActiveShift(null);
        if (navigationRef.isReady()) {
            navigationRef.resetRoot({ index: 0, routes: [{ name: 'Login' }] });
        }
        Alert.alert('Sesi Berakhir', `Tidak ada aktivitas selama ${AUTH_INACTIVITY_TIMEOUT_HOURS} jam. Silakan login kembali.`);
    }, [setActiveShift, setUser]);

    const recordUserActivity = useCallback(() => {
        if (!useStore.getState().user) return;
        const now = Date.now();
        lastInteractionRef.current = now;
        timeoutHandledRef.current = false;
        if (now - lastActivityWriteRef.current >= 10000) {
            lastActivityWriteRef.current = now;
            void markAuthActivity(now);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        const now = Date.now();
        lastInteractionRef.current = now;
        lastActivityWriteRef.current = now;
        timeoutHandledRef.current = false;
        void markAuthActivity(now);

        const timer = setInterval(() => {
            if (Date.now() - lastInteractionRef.current >= AUTH_INACTIVITY_TIMEOUT_MS) {
                void expireInactiveSession();
            }
        }, 15000);

        const subscription = AppState.addEventListener('change', async (state) => {
            if (state !== 'active' || !useStore.getState().user) return;
            const lastActivity = await getLastAuthActivity();
            if (!lastActivity || Date.now() - lastActivity >= AUTH_INACTIVITY_TIMEOUT_MS) {
                await expireInactiveSession();
                return;
            }
            lastInteractionRef.current = lastActivity;
        });

        return () => {
            clearInterval(timer);
            subscription.remove();
        };
    }, [user?.id, expireInactiveSession]);

    useEffect(() => {
        if (!user) return;
        const refreshLicense = async () => {
            const license = await resolveLicenseStatus();
            setSettings({ ...useStore.getState().settings, ...licenseToSettings(license) });
            if (!license.isActive && navigationRef.isReady()) {
                navigationRef.resetRoot({ index: 0, routes: [{ name: 'Lock' }] });
            }
        };
        void refreshLicense();
        const interval = setInterval(refreshLicense, 5 * 60 * 1000);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void refreshLicense();
        });
        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, [user?.id, setSettings]);

    const reconcileActiveShift = useCallback(async () => {
        const db = await getDBConnection();
        const [result] = await db.executeSql(
            `SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY openedAt DESC LIMIT 1`
        );
        if (result.rows.length === 0) {
            setActiveShift(null);
            return;
        }
        const shift = result.rows.item(0);
        setActiveShift({
            id: shift.id,
            openingCash: Number(shift.openingCash || 0),
            openedAt: shift.openedAt,
            expectedCloseAt: shift.expectedCloseAt || null,
            userName: shift.userName || undefined,
        });
    }, [setActiveShift]);

    // Initialize DB and settings on mount
    useEffect(() => {
        const initDB = async () => {
            try {
                const db = await getDBConnection();
                await createTables(db);
                await seedInitialData(db);

                const [settingsRes] = await db.executeSql('SELECT * FROM settings');
                const rowCount = settingsRes.rows.length;
                let loadedSettings: any = {
                    storeName: 'LitePOS', storeAddress: '', storePhone: '',
                    storeLogo: null, enablePreOrder: false, enableShift: true, enableShiftReminder: true,
                    shiftDurationMinutes: 480, shiftReminderMinutes: 15, shiftDayCutoff: '23:50',
                    enableDineTable: false, enableTableOrder: false, enableKitchenPrint: false,
                    showImages: true, printerAddress: null, printerType: null, theme: 'light',
                    apiBaseUrl: '',
                };
                for (let i = 0; i < rowCount; i++) {
                    const row = settingsRes.rows.item(i);
                    if (['showImages', 'enablePreOrder', 'enableShift', 'enableShiftReminder', 'enableDineTable', 'enableTableOrder', 'enableKitchenPrint'].includes(row.key)) {
                        loadedSettings[row.key] = row.value === 'true';
                    } else if (['shiftDurationMinutes', 'shiftReminderMinutes'].includes(row.key)) {
                        loadedSettings[row.key] = Number(row.value || 0);
                    } else {
                        loadedSettings[row.key] = row.value || null;
                    }
                }
                loadedSettings.apiBaseUrl = loadedSettings.apiBaseUrl
                    ? await persistApiBaseUrl(loadedSettings.apiBaseUrl)
                    : await hydrateApiBaseUrl();
                await db.executeSql(`INSERT OR REPLACE INTO settings (key, value) VALUES ('apiBaseUrl', ?)`, [loadedSettings.apiBaseUrl]);
                setSettings(loadedSettings);
                setColorScheme(loadedSettings.theme);
                console.log('DB and Settings initialized');
            } catch (error) {
                console.error('Failed to initialize DB:', error);
            }
        };
        initDB();
    }, [setSettings, setColorScheme]);

    // Restore an existing open shift from DB when user logs in
    useEffect(() => {
        if (!user) { setActiveShift(null); return; }
        const restoreShift = async () => {
            try {
                await reconcileActiveShift();
                // No open shift Ã¢â€ â€™ activeShift stays null, Dashboard shows Buka Shift card
            } catch (e) {
                console.error('Shift restore failed:', e);
            }
        };
        restoreShift();
    }, [user?.id, reconcileActiveShift, setActiveShift]);

    useEffect(() => {
        if (!user || !activeShift || !settings.enableShift) {
            shiftReminderGateRef.current = { key: '', nextAt: 0 };
            return;
        }

        const checkReminder = () => {
            const currentShift = useStore.getState().activeShift;
            const currentSettings = useStore.getState().settings;
            const reminder = getShiftReminder(currentShift, currentSettings);
            if (!reminder || !currentShift) return;

            const key = `${currentShift.id}:${reminder.phase}`;
            const now = Date.now();
            if (shiftReminderGateRef.current.key === key && shiftReminderGateRef.current.nextAt > now) return;
            shiftReminderGateRef.current = { key, nextAt: now + 15 * 60 * 1000 };

            Alert.alert(
                reminder.title,
                reminder.message,
                [
                    { text: 'Ingatkan 15 Menit', style: 'cancel' },
                    {
                        text: 'Tutup Shift',
                        onPress: () => {
                            if (navigationRef.isReady()) {
                                navigationRef.navigate('Main', {
                                    screen: 'Beranda',
                                    params: { openCloseShift: true },
                                });
                            }
                        },
                    },
                ]
            );
        };

        checkReminder();
        const interval = setInterval(checkReminder, 60 * 1000);
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') checkReminder();
        });
        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, [
        activeShift?.id,
        activeShift?.expectedCloseAt,
        settings.enableShift,
        settings.enableShiftReminder,
        settings.shiftDurationMinutes,
        settings.shiftReminderMinutes,
        settings.shiftDayCutoff,
        user?.id,
    ]);

    // Setup Data Synchronization Polling (Foreground for now)
    useEffect(() => {
        if (!user) return; // Only sync when logged in

        const syncData = async () => {
            try {
                // Reset outlet harus direkonsiliasi sebelum satu pun data lokal diunggah.
                // Jika pemeriksaan gagal, sinkronisasi dihentikan agar data lama tidak hidup kembali.
                const resetRes: any = await syncService.reconcileResetState();
                if (!resetRes.success) {
                    console.log('Status reset outlet gagal diperiksa; sinkronisasi ditunda.', resetRes.error);
                    return;
                }
                if (resetRes.resetApplied) {
                    if (resetRes.scopes?.includes('ALL')) setActiveShift(null);
                    useStore.getState().clearCart();
                    console.log(`Reset outlet versi ${resetRes.version} (${resetRes.scopes?.join(', ')}) diterapkan ke perangkat.`);
                }

                // Kirim perubahan lokal lebih dulu agar pull tidak menimpa data offline.
                let pushRes: any = await syncService.pushLocalData();
                if (!pushRes.success) {
                    console.log('Push data lokal gagal; pull ditunda untuk melindungi perubahan lokal.', pushRes.error);
                    return;
                }

                // 1. Fetch Master Data
                console.log('Ã°Å¸â€â€ž Syncing master data...');
                const masterRes = await syncService.syncMasterData();
                if (masterRes.success) {
                    console.log('Ã¢Å“â€¦ Master data synced successfully');
                    
                    // Reload settings from SQLite into Zustand store after sync
                    try {
                        const db = await getDBConnection();
                        const [settingsRes] = await db.executeSql('SELECT * FROM settings');
                        const rowCount = settingsRes.rows.length;
                        let reloadedSettings: any = {
                            storeName: 'LitePOS', storeAddress: '', storePhone: '',
                            storeLogo: null, enablePreOrder: false, enableShift: true, enableShiftReminder: true,
                            shiftDurationMinutes: 480, shiftReminderMinutes: 15, shiftDayCutoff: '23:50',
                            enableDineTable: false, enableTableOrder: false, enableKitchenPrint: false,
                            showImages: true, printerAddress: null, printerType: null, theme: 'light',
                            allowNegativeStock: false, receiptFooter: '',
                            loyalty_active: false, loyalty_multiplier: 1, loyalty_multiplier_amount: 1000,
                            loyalty_point_value: 0, loyalty_min_points: 0,
                            apiBaseUrl: '',
                            dataResetVersion: 0, dataResetAt: '', dataResetType: '',
                        };
                        for (let i = 0; i < rowCount; i++) {
                            const row = settingsRes.rows.item(i);
                            if (['showImages', 'enablePreOrder', 'enableShift', 'enableShiftReminder', 'enableDineTable', 'enableTableOrder', 'allowNegativeStock', 'loyalty_active', 'enableKitchenPrint'].includes(row.key)) {
                                reloadedSettings[row.key] = row.value === 'true';
                            } else if (['shiftDurationMinutes', 'shiftReminderMinutes', 'loyalty_multiplier', 'loyalty_multiplier_amount', 'loyalty_point_value', 'loyalty_min_points', 'dataResetVersion'].includes(row.key)) {
                                reloadedSettings[row.key] = Number(row.value || 0);
                            } else {
                                reloadedSettings[row.key] = row.value || null;
                            }
                        }
                        reloadedSettings.apiBaseUrl = reloadedSettings.apiBaseUrl
                            ? await persistApiBaseUrl(reloadedSettings.apiBaseUrl)
                            : await hydrateApiBaseUrl();
                        setSettings(reloadedSettings);
                    } catch (reloadErr) {
                        console.error('Failed to reload settings after sync:', reloadErr);
                    }
                } else {
                    console.log('Master data gagal ditarik:', masterRes.error);
                    return;
                }

                if (pushRes.requiresMasterSync) {
                    pushRes = await syncService.pushLocalData();
                    if (!pushRes.success) {
                        console.log('Push setelah initial sync gagal:', pushRes.error);
                        return;
                    }
                }

                // 2. Push Pending Local Transactions
                console.log('Ã°Å¸â€â€ž Pushing local data...');
                // Perubahan lokal sudah dikirim sebelum master data ditarik.
                if (pushRes.success) {
                    if (pushRes.message === 'No local data to sync') {
                        console.log('Ã¢â€žÂ¹Ã¯Â¸Â No local data to push');
                    } else {
                        console.log('Ã¢Å“â€¦ Local data pushed successfully');
                    }
                } else {
                     console.log('Ã¢ÂÅ’ Failed to push local data:', pushRes.error);
                }

                // 3. Pull transaction history from server (30 days)
                console.log('Ã°Å¸â€â€ž Syncing transaction history...');
                const historyRes = await syncService.syncTransactionHistory();
                if (historyRes.success) {
                    await reconcileActiveShift();
                    console.log('Ã¢Å“â€¦ Transaction history synced');
                } else {
                    console.log('Ã¢Å¡Â Ã¯Â¸Â Transaction history sync failed:', historyRes.error);
                }

            } catch (error) {
                console.error('Ã¢ÂÅ’ Sync failed:', error);
            }
        };

        // Sync every 60 seconds
        const intervalId = setInterval(syncData, 60000);
        
        // Initial sync on startup
        syncData();

        return () => clearInterval(intervalId);
    }, [user, reconcileActiveShift, setActiveShift]);

    return (
        <SafeAreaProvider>
            <AppDialogProvider>
                <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colorScheme === 'dark' ? tw.color('gray-900') : tw.color('white')} />
                <SafeAreaView style={tw`flex-1 bg-white dark:bg-gray-900`} onTouchStart={recordUserActivity}>
                    <NavigationContainer ref={navigationRef} theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                        <Stack.Navigator screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="Login" component={LoginScreen} />
                            <Stack.Screen name="Lock" component={LockScreen} />
                                    <Stack.Screen name="Main" component={MainTabNavigator} />
                                    <Stack.Screen name="POS" component={ShiftGuardedPOS} />
                                    <Stack.Screen name="TableOrders" component={TableOrdersScreen} />
                                    <Stack.Screen name="Checkout" component={CheckoutScreen} />
                                    <Stack.Screen
                                        name="ReceiptPreview"
                                        component={ReceiptPreviewScreen}
                                        options={{
                                            presentation: 'transparentModal',
                                            animation: 'fade',
                                            contentStyle: { backgroundColor: 'transparent' },
                                        }}
                                    />
                                    <Stack.Screen name="UserManagement" component={UserManagementScreen} />
                                    <Stack.Screen name="StockReceiving" component={StockReceivingScreen} />
                                    <Stack.Screen name="StockOpname" component={StockOpnameScreen} />
                                    <Stack.Screen name="TableManagement" component={TableManagementScreen} />
                                    <Stack.Screen name="Management" component={ManagementScreen} />
                                    <Stack.Screen name="PackageList" component={PackageScreen} />
                                    <Stack.Screen name="ProductList" component={ProductListScreen} />
                                    <Stack.Screen name="CategoryList" component={CategoryListScreen} />
                            <Stack.Screen name="StockHistory" component={StockHistoryScreen} />
                        </Stack.Navigator>
                    </NavigationContainer>
                
                {settings.license_type === 'TRIAL' && settings.license_status === 'ACTIVE' && user && (
                    <View style={tw`absolute top-12 right-0 bg-amber-600 px-3 py-1.5 rounded-l-full shadow-lg z-50 flex-row items-center opacity-90`}>
                        <Icon name="clock-outline" size={12} color="white" style={tw`mr-1.5`} />
                        <Text style={tw`text-white text-xs font-black tracking-wider`}>TRIAL MODE</Text>
                    </View>
                )}
                </SafeAreaView>
            </AppDialogProvider>
        </SafeAreaProvider>
    );
}

export default App;





