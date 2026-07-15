/**
 * DashboardScreen.tsx
 * Redesigned UI matching reference design from C:\pos
 * Icons: MaterialCommunityIcons (react-native-vector-icons)
 * Font: Poppins | Animations: Animated native
 * ALL business logic preserved from original
 */

import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Modal, FlatList,
    Linking, Alert, TextInput, StyleSheet, Animated, Dimensions,
    Platform, StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { getDBConnection, getStoreSummary } from '../database/db';
import tw, { useAppColorScheme } from 'twrnc';
import { getPaidAmount, getPaymentStatusLabel, getPaymentStatusMessage, getRemainingAmount } from '../utils/preOrderPayment';
import { openCashierShift } from '../services/shiftService';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const getColors = (isDark: boolean) => ({
    primary:       '#1A5CFF',
    primaryDeep:   isDark ? '#3D7BFF' : '#1240CC',
    primaryLight:  isDark ? '#1A2A4A' : '#EEF3FF',
    primaryMid:    '#3D7BFF',
    accent:        '#00C896',
    accentLight:   isDark ? '#003326' : '#E6FAF5',
    danger:        '#FF3B5C',
    dangerLight:   isDark ? '#4A111A' : '#FFF0F3',
    warning:       '#FF9500',
    warningLight:  isDark ? '#4A2B00' : '#FFF5E6',
    white:         isDark ? '#1F2937' : '#FFFFFF',
    bg:            isDark ? '#111827' : '#F5F7FC',
    card:          isDark ? '#1F2937' : '#FFFFFF',
    border:        isDark ? '#374151' : '#E8EEFF',
    textPrimary:   isDark ? '#F9FAFB' : '#0D1B4B',
    textSecondary: isDark ? '#9CA3AF' : '#6B7A9F',
    textMuted:     isDark ? '#6B7280' : '#A0ADCC',
    shadow:        isDark ? 'rgba(0,0,0,0.5)' : 'rgba(26,92,255,0.12)',
});

const useThemeColors = () => {
    const [colorScheme] = useAppColorScheme(tw);
    const isDark = colorScheme === 'dark';
    return getColors(isDark);
};

const useStyles = () => {
    const COLORS = useThemeColors();
    return React.useMemo(() => getStyles(COLORS), [COLORS]);
};

const FONTS = {
    bold:     { fontFamily: 'Poppins-Bold',     fontWeight: '700' as const },
    semibold: { fontFamily: 'Poppins-SemiBold', fontWeight: '600' as const },
    medium:   { fontFamily: 'Poppins-Medium',   fontWeight: '500' as const },
    regular:  { fontFamily: 'Poppins-Regular',  fontWeight: '400' as const },
};

const formatRp = (num: number) => 'Rp ' + (num || 0).toLocaleString('id-ID');

const formatDateDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    const d = isoDate.substring(0, 10).split('-');
    if (d.length !== 3) return isoDate.substring(0, 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d[2]} ${months[parseInt(d[1]) - 1]} ${d[0]}`;
};

const toLocalDate = (isoDay: string) => {
    const [y, m, d] = isoDay.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
};

// ─── STAT CARD COMPONENT ─────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color, bgColor, onPress, delay = 0, fill = true }: any) => {
    const COLORS = useThemeColors();
    const styles = useStyles();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
        ]).start();
    }, []);

    const handlePressIn = () =>
        Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
    const handlePressOut = () =>
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

    return (
        <Animated.View style={[
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
            fill ? { flex: 1 } : null,
        ]}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[styles.statCard, { backgroundColor: bgColor }]}
            >
                <View style={[styles.statIconWrap, { backgroundColor: color + '22' }]}>
                    <Icon name={icon} size={20} color={color} />
                </View>
                <Text style={[styles.statLabel, { color: color }]}>{label}</Text>
                <Text style={[styles.statValue, { color: COLORS.textPrimary }]}>{value}</Text>
                {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
            </TouchableOpacity>
        </Animated.View>
    );
};

// ─── MENU ITEM COMPONENT ─────────────────────────────────────────────────────
const MenuItem = ({ icon, title, subtitle, color, bgColor, primary, onPress, delay = 0, style }: any) => {
    const COLORS = useThemeColors();
    const styles = useStyles();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
        ]).start();
    }, []);

    const handlePressIn = () =>
        Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
    const handlePressOut = () =>
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

    if (primary) {
        return (
        <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }, style]}>
            <TouchableOpacity
                    activeOpacity={1}
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    style={styles.menuItemPrimary}
                >
                    <View style={styles.blobTL} />
                    <View style={styles.blobBR} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.menuTitlePrimary}>{title}</Text>
                        <Text style={styles.menuSubPrimary}>{subtitle}</Text>
                    </View>
                    <View style={styles.menuIconWrapPrimary}>
                        <Icon name={icon} size={26} color={COLORS.primary} />
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    }

    return (
        <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }, style]}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.menuItem}
            >
                <View style={[styles.menuIconWrap, { backgroundColor: bgColor || COLORS.primaryLight }]}>
                    <Icon name={icon} size={22} color={color || COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.menuTitle}>{title}</Text>
                    <Text style={styles.menuSub}>{subtitle}</Text>
                </View>
                <View style={styles.menuChevron}>
                    <Icon name="chevron-right" size={20} color={COLORS.textMuted} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ─── MAIN DASHBOARD SCREEN ──────────────────────────────────────────────────
export default function DashboardScreen({ navigation }: any) {
    const COLORS = useThemeColors();
    const styles = useStyles();
    const user = useStore((state) => state.user);
    const setUser = useStore((state) => state.setUser);
    const activeShift = useStore((state) => state.activeShift);
    const setActiveShift = useStore((state) => state.setActiveShift);
    const [summary, setSummary] = useState({ todayRevenue: 0, todayCount: 0, todayReturns: 0, productsCount: 0, lowStockCount: 0 });
    const [openingCashInput, setOpeningCashInput] = useState('');
    const [closingCashInput, setClosingCashInput] = useState('');
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const tableOrderNotificationCount = useStore((state) => state.tableOrderNotificationCount);
    const [upcomingPreOrders, setUpcomingPreOrders] = useState<any[]>([]);
    const settings = useStore(state => state.settings);

    const [selectedDateOrders, setSelectedDateOrders] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [showPreOrderModal, setShowPreOrderModal] = useState(false);
    const [shiftSummary, setShiftSummary] = useState({ totalSales: 0, totalExpenses: 0 });
    const [pickupPaymentOrder, setPickupPaymentOrder] = useState<any>(null);
    const [pickupPaymentMethod, setPickupPaymentMethod] = useState('CASH');
    const [pickupCashAmount, setPickupCashAmount] = useState('');

    // Animations
    const headerAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const loadData = async () => {
        try {
            const db = await getDBConnection();
                        const data = await getStoreSummary(db);
            
            const [prodRes] = await db.executeSql('SELECT COUNT(*) as count FROM products');
            const productsCount = prodRes.rows.item(0).count || 0;
            
            const [lowStockRes] = await db.executeSql('SELECT COUNT(*) as count FROM products WHERE stock <= minStock AND isUnlimitedStock = 0');
            const lowStockCount = lowStockRes.rows.item(0).count || 0;
            
            setSummary({ ...data, productsCount, lowStockCount });

            const [pendingRes] = await db.executeSql('SELECT COUNT(*) as count FROM saved_transactions');
            setPendingCount(pendingRes.rows.item(0).count || 0);

            const today = new Date().toISOString().split('T')[0];
            const [preRes] = await db.executeSql(
                `SELECT t.id, t.invoiceNumber, t.customerName, t.customerId,
                        t.preOrderDate, t.grandTotal, t.status, t.preOrderConfirmed,
                        t.paymentStatus, t.paidAmount, t.remainingAmount, t.paidAt,
                        c.phone as customerPhone
                 FROM transactions t
                 LEFT JOIN customers c ON t.customerId = c.id
                 WHERE t.preOrderDate >= ? AND t.status = 'COMPLETED'
                   AND (t.preOrderConfirmed IS NULL OR t.preOrderConfirmed = 0)
                 ORDER BY t.preOrderDate ASC`,
                [today]
            );

            const dateMap: Record<string, any[]> = {};
            for (let i = 0; i < preRes.rows.length; i++) {
                const item = preRes.rows.item(i);
                const dateKey = item.preOrderDate?.substring(0, 10) || '';
                if (!dateMap[dateKey]) dateMap[dateKey] = [];
                dateMap[dateKey].push(item);
            }

            const grouped = Object.entries(dateMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, orders]) => ({ date, orders }));

            setUpcomingPreOrders(grouped);

            const currentShift = activeShift;
            if (currentShift?.openedAt) {
                const since = currentShift.openedAt;
                const [salesRes] = await db.executeSql(
                    `SELECT COALESCE(SUM(
                        CASE
                            WHEN COALESCE(paidAmount, 0) > 0 THEN paidAmount
                            ELSE grandTotal
                        END
                    ), 0) as total FROM transactions
                     WHERE COALESCE(paidAt, createdAt) >= ?
                       AND status = 'COMPLETED'
                       AND COALESCE(paymentStatus, 'PAID') = 'PAID'`,
                    [since]
                );
                const [expRes] = await db.executeSql(
                    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE createdAt >= ?`,
                    [since]
                );
                setShiftSummary({
                    totalSales: salesRes.rows.item(0).total || 0,
                    totalExpenses: expRes.rows.item(0).total || 0,
                });
            } else {
                setShiftSummary({ totalSales: 0, totalExpenses: 0 });
            }
        } catch (e) {
            console.error('Dashboard error', e);
        }
    };

    useEffect(() => {
        loadData();
        const unsubscribe = navigation.addListener('focus', loadData);
        return unsubscribe;
    }, [navigation]);

    const handleLogout = () => {
        Alert.alert('Konfirmasi Keluar', 'Apakah Anda yakin ingin keluar dari aplikasi?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Ya, Keluar',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                        await AsyncStorage.removeItem('@auth_token');
                        await AsyncStorage.removeItem('@auth_user');
                    } catch (e) {
                        console.error('Gagal hapus session:', e);
                    }
                    setUser(null);
                    navigation.replace('Login');
                }
            }
        ]);
    };

    const handleOpenShift = async () => {
        const cash = parseFloat(openingCashInput.replace(/[^0-9]/g, '') || '0');
        try {
            const shift = await openCashierShift(user, cash);
            setActiveShift(shift);
            setOpeningCashInput('');
        } catch (e) {
            Alert.alert('Error', 'Gagal membuka shift.');
        }
    };

    const handleCloseShift = () => {
        if (!activeShift) return;
        setClosingCashInput('');
        setShowCloseShiftModal(true);
    };

    const confirmCloseShift = async () => {
        if (!activeShift) return;
        const closingCash = parseFloat(closingCashInput.replace(/[^0-9]/g, '') || '0');
        try {
            const db = await getDBConnection();
            await db.executeSql(
                `UPDATE shifts SET status = 'CLOSED', closedAt = ?, closingCash = ? WHERE id = ?`,
                [new Date().toISOString(), closingCash, activeShift.id]
            );
            const accumulated = activeShift.openingCash + shiftSummary.totalSales - shiftSummary.totalExpenses;
            const diff = closingCash - accumulated;
            setShowCloseShiftModal(false);
            setActiveShift(null);
            setShiftSummary({ totalSales: 0, totalExpenses: 0 });
            Alert.alert(
                'Shift Ditutup',
                `Kas Awal      : ${formatRp(activeShift.openingCash)}\n` +
                `+ Penjualan   : ${formatRp(shiftSummary.totalSales)}\n` +
                `− Pengeluaran : ${formatRp(shiftSummary.totalExpenses)}\n` +
                `─────────────────────\n` +
                `Saldo Akumulasi: ${formatRp(accumulated)}\n` +
                `Kas Fisik Akhir: ${formatRp(closingCash)}\n` +
                `Selisih Kas   : ${diff >= 0 ? '+' : ''}${formatRp(diff)}`
            );
        } catch (e) {
            Alert.alert('Error', 'Gagal menutup shift.');
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 11) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    const openPreOrderDetail = (dateGroup: { date: string; orders: any[] }) => {
        setSelectedDate(dateGroup.date);
        setSelectedDateOrders([...dateGroup.orders]);
        setShowPreOrderModal(true);
    };

    const getOrderStatusBadgeStyle = (status?: string) => {
        if (status === 'UNPAID') return [styles.orderStatusBadge, { backgroundColor: COLORS.dangerLight }];
        if (status === 'PARTIAL') return [styles.orderStatusBadge, { backgroundColor: COLORS.warningLight }];
        return styles.orderStatusBadge;
    };

    const getOrderStatusTextStyle = (status?: string) => {
        if (status === 'UNPAID') return [styles.orderStatusText, { color: COLORS.danger }];
        if (status === 'PARTIAL') return [styles.orderStatusText, { color: COLORS.warning }];
        return styles.orderStatusText;
    };

    const openWhatsApp = (order: any) => {
        const rawPhone = order.customerPhone || '';
        let phone = rawPhone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
        if (!phone) {
            Alert.alert(
                'Tidak ada nomor HP',
                `Pelanggan "${order.customerName}" tidak memiliki nomor HP yang tersimpan.`
            );
            return;
        }
        const storeName = settings?.storeName || 'LitePOS';
        const dateDisplay = formatDateDisplay(selectedDate);
        const paymentMessage = getPaymentStatusMessage(order, formatRp);
        const message = encodeURIComponent(
            `Halo ${order.customerName}, pesanan Anda di ${storeName} sudah siap untuk diambil pada ${dateDisplay}.\n${paymentMessage}\nSilahkan segera diambil. Terima kasih!`
        );
        Linking.openURL(`whatsapp://send?phone=${phone}&text=${message}`).catch(() => {
            Alert.alert('WhatsApp tidak tersedia', 'Pastikan WhatsApp sudah terinstall di HP ini.');
        });
    };

    const markOrderConfirmed = async (order: any) => {
        const db = await getDBConnection();
        await db.executeSql(
            `UPDATE transactions SET preOrderConfirmed = 1, isSynced = 0 WHERE id = ?`,
            [order.id]
        );
        const updated = selectedDateOrders.filter(o => o.id !== order.id);
        setSelectedDateOrders(updated);
        if (updated.length === 0) setShowPreOrderModal(false);
        loadData();
    };

    const confirmOrder = (order: any) => {
        if (getRemainingAmount(order) > 0) {
            setPickupPaymentOrder(order);
            setPickupPaymentMethod('CASH');
            setPickupCashAmount('');
            return;
        }

        Alert.alert(
            'Konfirmasi Pengambilan',
            `Tandai pesanan "${order.customerName}" (${order.invoiceNumber}) sebagai sudah diambil?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, Sudah Diambil',
                    onPress: async () => {
                        try {
                            await markOrderConfirmed(order);
                        } catch (e) {
                            Alert.alert('Error', 'Gagal mengkonfirmasi pesanan.');
                        }
                    }
                }
            ]
        );
    };

    const confirmPickupPayment = async () => {
        if (!pickupPaymentOrder) return;
        const remaining = getRemainingAmount(pickupPaymentOrder);
        const rawCash = parseInt(pickupCashAmount.replace(/\D/g, '') || '0', 10);
        if (pickupPaymentMethod === 'CASH' && rawCash < remaining) {
            Alert.alert('Uang Kurang', `Uang tunai tidak cukup.\nKurang: ${formatRp(remaining - rawCash)}`);
            return;
        }

        try {
            const db = await getDBConnection();
            const paidAt = new Date().toISOString();
            await db.executeSql(
                `UPDATE transactions
                 SET paymentStatus = 'PAID',
                     paidAmount = grandTotal,
                     remainingAmount = 0,
                     paymentMethod = ?,
                     cashAmount = ?,
                     changeAmount = ?,
                     paidAt = ?,
                     preOrderConfirmed = 1,
                     isSynced = 0
                 WHERE id = ?`,
                [
                    pickupPaymentMethod,
                    pickupPaymentMethod === 'CASH' ? rawCash : remaining,
                    pickupPaymentMethod === 'CASH' ? Math.max(0, rawCash - remaining) : 0,
                    paidAt,
                    pickupPaymentOrder.id
                ]
            );

            const updated = selectedDateOrders.filter(o => o.id !== pickupPaymentOrder.id);
            setSelectedDateOrders(updated);
            if (updated.length === 0) setShowPreOrderModal(false);
            setPickupPaymentOrder(null);
            setPickupCashAmount('');
            loadData();
        } catch (e) {
            Alert.alert('Error', 'Gagal menyimpan pelunasan pesanan.');
        }
    };

    const totalPreOrderCount = upcomingPreOrders.reduce((s, g) => s + (g.orders || []).length, 0);

    const updateTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

            {/* ═══ HEADER ═══ */}
            <Animated.View style={[styles.header, { opacity: headerAnim }]}>
                <View style={styles.headerLeft}>
                    <View style={styles.avatarWrap}>
                        <Icon name="account" size={20} color={COLORS.primary} />
                    </View>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()}</Text>
                        <Text style={styles.ownerName}>{user?.name || 'Owner'}</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.notifBtn}
                        accessibilityLabel={`${tableOrderNotificationCount} order meja baru`}
                        onPress={() => {
                            if (settings.enableTableOrder) navigation.navigate('TableOrders');
                            else Alert.alert('Order Meja tidak aktif', 'Aktifkan fitur Order Meja dari pengaturan web.');
                        }}
                    >
                        <Icon name="bell-outline" size={22} color={COLORS.textPrimary} />
                        {tableOrderNotificationCount > 0 && (
                            <View style={styles.notifBadge}>
                                <Text style={styles.notifBadgeText}>{tableOrderNotificationCount > 99 ? '99+' : tableOrderNotificationCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Icon name="logout-variant" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ═══ SHIFT BANNER ═══ */}
                {settings.enableShift && (!activeShift ? (
                    <View style={styles.shiftBannerClosed}>
                        <View style={styles.shiftClosedHeader}>
                            <View style={styles.shiftIconBox}>
                                <Icon name="briefcase-outline" size={18} color={COLORS.primary} />
                            </View>
                            <View style={styles.shiftClosedTitleBlock}>
                                <Text style={styles.shiftClosedTitle}>Buka shift kasir</Text>
                                <Text style={styles.shiftClosedSub}>Catat uang tunai sebelum transaksi pertama.</Text>
                            </View>
                            <View style={styles.shiftInactiveBadge}>
                                <View style={styles.shiftInactiveDot} />
                                <Text style={styles.shiftInactiveText}>Belum aktif</Text>
                            </View>
                        </View>
                        <View style={styles.shiftInputRow}>
                            <View style={styles.shiftInputWrapCompact}>
                                <Text style={styles.shiftInputPrefixCompact}>Rp</Text>
                                <TextInput
                                    style={styles.shiftInput}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor={COLORS.textMuted}
                                    value={openingCashInput ? parseInt(openingCashInput.replace(/[^0-9]/g, '') || '0', 10).toLocaleString('id-ID') : ''}
                                    onChangeText={t => setOpeningCashInput(t.replace(/[^0-9]/g, ''))}
                                    onSubmitEditing={handleOpenShift}
                                />
                            </View>
                            <TouchableOpacity style={styles.shiftOpenBtn} onPress={handleOpenShift}>
                                <Icon name="play" size={15} color="#FFFFFF" />
                                <Text style={styles.shiftOpenBtnText}>Mulai</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.shiftBannerActive}>
                        <View style={styles.shiftActiveTop}>
                            <View style={styles.shiftActiveIdentity}>
                                <View style={styles.shiftActiveBadge}>
                                    <View style={styles.shiftActiveDot} />
                                    <Text style={styles.shiftActiveBadgeText}>Shift aktif</Text>
                                </View>
                                <Text style={styles.shiftActiveLabel}>
                                    {user?.name} | buka {new Date(activeShift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleCloseShift} style={styles.shiftCloseBtn}>
                                <Icon name="lock-outline" size={14} color={COLORS.danger} style={{ marginRight: 5 }} />
                                <Text style={styles.shiftCloseBtnText}>Tutup</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.shiftBalanceRow}>
                            <View>
                                <Text style={styles.shiftBalanceLabel}>Saldo kas seharusnya</Text>
                                <Text style={styles.shiftBalanceHint}>Kas awal + penjualan - pengeluaran</Text>
                            </View>
                            <Text style={styles.shiftTotalValue} numberOfLines={1} adjustsFontSizeToFit>
                                {formatRp(activeShift.openingCash + shiftSummary.totalSales - shiftSummary.totalExpenses)}
                            </Text>
                        </View>
                        <View style={styles.shiftBreakdown}>
                            <View style={styles.shiftMetric}>
                                <Text style={styles.shiftRowLabel}>Kas awal</Text>
                                <Text style={styles.shiftRowValue} numberOfLines={1} adjustsFontSizeToFit>{formatRp(activeShift.openingCash)}</Text>
                            </View>
                            <View style={styles.shiftMetricDivider} />
                            <View style={styles.shiftMetric}>
                                <Text style={styles.shiftRowLabel}>Penjualan</Text>
                                <Text style={[styles.shiftRowValue, styles.shiftSalesValue]} numberOfLines={1} adjustsFontSizeToFit>+{formatRp(shiftSummary.totalSales)}</Text>
                            </View>
                            <View style={styles.shiftMetricDivider} />
                            <View style={styles.shiftMetric}>
                                <Text style={styles.shiftRowLabel}>Pengeluaran</Text>
                                <Text style={[styles.shiftRowValue, styles.shiftExpenseValue]} numberOfLines={1} adjustsFontSizeToFit>-{formatRp(shiftSummary.totalExpenses)}</Text>
                            </View>
                        </View>
                    </View>
                ))}

                {/* ═══ HERO & STATS ROW (RESPONSIVE) ═══ */}
                {isTablet ? (
                    <View style={styles.tabletHeroRow}>
                        <Animated.View style={[styles.heroCard, styles.tabletHeroCard, { opacity: headerAnim }]}>
                            <View style={styles.heroBlob1} />
                            <View style={styles.heroBlob2} />
                            <View style={styles.heroTop}>
                                <View style={styles.tabletHeroTitleBlock}>
                                    <Text style={styles.heroLabel}>Pendapatan Hari Ini</Text>
                                    <Text
                                        style={[styles.heroValue, styles.tabletHeroValue]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.72}
                                    >
                                        {formatRp(summary.todayRevenue)}
                                    </Text>
                                </View>
                                <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.navigate('Laporan')}>
                                    <Icon name="arrow-top-right" size={16} color={COLORS.white} />
                                    <Text style={styles.heroBtnText}>Laporan</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.tabletHeroFooter}>
                                <View style={styles.heroDivider} />
                                <View style={[styles.heroBottom, styles.tabletHeroBottom]}>
                                    <View style={[styles.heroStat, styles.tabletHeroStatPill]}>
                                        <Icon name="trending-up" size={14} color={COLORS.accent} />
                                        <Text style={[styles.heroStatTextGreen, styles.tabletHeroStatText]}>
                                            {summary.todayReturns > 0 ? `${summary.todayReturns} Retur` : `${summary.todayCount} Transaksi`}
                                        </Text>
                                    </View>
                                    <View style={[styles.heroStat, styles.tabletHeroStatPill]}>
                                        <Icon name="clock-outline" size={14} color={COLORS.white + 'AA'} />
                                        <Text style={[styles.heroStatTextMuted, styles.tabletHeroStatText]}>Update: {updateTime}</Text>
                                    </View>
                                </View>
                            </View>
                        </Animated.View>
                        <View style={styles.tabletStatColumn}>
                            <StatCard
                                icon="cart-variant"
                                label="Transaksi"
                                value={String(summary.todayCount)}
                                sub="Sukses hari ini"
                                color={COLORS.accent}
                                bgColor={COLORS.accentLight}
                                fill={false}
                                delay={100}
                                onPress={() => navigation.navigate('Laporan')}
                            />
                            <View style={{ height: 12 }} />
                            <StatCard
                                icon="package-variant"
                                label="Produk"
                                value={String(summary.productsCount)}
                                sub="Item aktif"
                                color={COLORS.primary}
                                bgColor={COLORS.primaryLight}
                                fill={false}
                                delay={150}
                                onPress={() => navigation.navigate('Main', { screen: 'Inventori' })}
                            />
                            <View style={{ height: 12 }} />
                            <StatCard
                                icon="alert-circle-outline"
                                label="Stok"
                                value={String(summary.lowStockCount)}
                                sub="Hampir habis"
                                color={COLORS.warning}
                                bgColor={COLORS.warningLight}
                                fill={false}
                                delay={200}
                                onPress={() => navigation.navigate('Main', { screen: 'Inventori' })}
                            />
                        </View>
                    </View>
                ) : (
                    <>
                        {/* ═══ HERO REVENUE CARD ═══ */}
                        <Animated.View style={[styles.heroCard, { opacity: headerAnim }]}>
                            <View style={styles.heroBlob1} />
                            <View style={styles.heroBlob2} />
                            <View style={styles.heroTop}>
                                <View>
                                    <Text style={styles.heroLabel}>Pendapatan Hari Ini</Text>
                                    <Text style={styles.heroValue}>{formatRp(summary.todayRevenue)}</Text>
                                </View>
                                <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.navigate('Laporan')}>
                                    <Icon name="arrow-top-right" size={16} color={COLORS.white} />
                                    <Text style={styles.heroBtnText}>Laporan</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.heroDivider} />
                            <View style={styles.heroBottom}>
                                <View style={styles.heroStat}>
                                    <Icon name="trending-up" size={14} color={COLORS.accent} />
                                    <Text style={styles.heroStatTextGreen}>
                                        {summary.todayReturns > 0 ? `${summary.todayReturns} Retur` : `${summary.todayCount} Transaksi`}
                                    </Text>
                                </View>
                                <View style={styles.heroStat}>
                                    <Icon name="clock-outline" size={14} color={COLORS.white + 'AA'} />
                                    <Text style={styles.heroStatTextMuted}>Update: {updateTime}</Text>
                                </View>
                            </View>
                        </Animated.View>

                        {/* ═══ STAT CARDS ROW ═══ */}
                        <View style={styles.statsRow}>
                            <StatCard
                                icon="cart-variant"
                                label="Transaksi"
                                value={String(summary.todayCount)}
                                sub="Sukses hari ini"
                                color={COLORS.accent}
                                bgColor={COLORS.accentLight}
                                delay={100}
                                onPress={() => navigation.navigate('Laporan')}
                            />
                            <View style={{ width: 12 }} />
                            <StatCard
                                icon="package-variant"
                                label="Produk"
                                value={String(summary.productsCount)}
                                sub="Item aktif"
                                color={COLORS.primary}
                                bgColor={COLORS.primaryLight}
                                delay={150}
                                onPress={() => navigation.navigate('Main', { screen: 'Inventori' })}
                            />
                            <View style={{ width: 12 }} />
                            <StatCard
                                icon="alert-circle-outline"
                                label="Stok"
                                value={String(summary.lowStockCount)}
                                sub="Hampir habis"
                                color={COLORS.warning}
                                bgColor={COLORS.warningLight}
                                delay={200}
                                onPress={() => navigation.navigate('Main', { screen: 'Inventori' })}
                            />
                        </View>
                    </>
                )}

                {/* ═══ PENDING SALES ALERT ═══ */}
                {pendingCount > 0 && (
                    <TouchableOpacity
                        style={styles.pendingAlert}
                        onPress={() => navigation.navigate('POS')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.pendingTitle}>Penjualan Tersimpan</Text>
                            <Text style={styles.pendingSub}>Ada {pendingCount} penjualan pending — tap untuk lanjutkan</Text>
                        </View>
                        <Icon name="chevron-right" size={16} color={COLORS.warning} />
                    </TouchableOpacity>
                )}

                {/* ═══ PRE-ORDER SECTION ═══ */}
                {settings.enablePreOrder && upcomingPreOrders.length > 0 && (
                    <View style={styles.preOrderCard}>
                        <View style={styles.preOrderHeader}>
                            <View style={styles.preOrderIconWrap}>
                                <Icon name="calendar" size={16} color="#7C3AED" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.preOrderHeaderTitle}>Pre-Order Mendatang</Text>
                                <Text style={styles.preOrderHeaderSub}>
                                    {totalPreOrderCount} pesanan · {upcomingPreOrders.length} tanggal — tap untuk detail
                                </Text>
                            </View>
                        </View>

                        {upcomingPreOrders.map((group, idx) => {
                            const orderDate = toLocalDate(group.date);
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            const diffDays = Math.round((orderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            const isToday = diffDays === 0;
                            const isPast = diffDays < 0;
                            const isUrgent = isToday || isPast;
                            const daysLabel = isPast
                                ? `${Math.abs(diffDays)} hari lalu`
                                : isToday ? 'Hari ini!'
                                    : diffDays === 1 ? 'Besok'
                                        : `${diffDays} hari lagi`;

                            return (
                                <TouchableOpacity
                                    key={group.date}
                                    style={[
                                        styles.preOrderRow,
                                        idx > 0 && { borderTopWidth: 1, borderTopColor: '#F3E8FF' },
                                        isUrgent && { backgroundColor: COLORS.dangerLight },
                                    ]}
                                    onPress={() => openPreOrderDetail(group)}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                            <Text style={[styles.preOrderDate, isUrgent && { color: '#991B1B' }]}>
                                                {formatDateDisplay(group.date)}
                                            </Text>
                                            <View style={[styles.preOrderBadge, isUrgent && { backgroundColor: '#FEE2E2' }]}>
                                                <Text style={[styles.preOrderBadgeText, isUrgent && { color: '#B91C1C' }]}>
                                                    {(group.orders || []).length} pesanan
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.preOrderCustomers, isUrgent && { color: '#FCA5A5' }]} numberOfLines={1}>
                                            {(group.orders || []).slice(0, 2).map((o: any) => o.customerName || 'Pelanggan').join(', ')}
                                            {(group.orders || []).length > 2 ? ` +${(group.orders || []).length - 2} lagi` : ''}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                                        <View style={[styles.preOrderDaysBadge, isUrgent && { backgroundColor: '#FEE2E2' }]}>
                                            <Text style={[styles.preOrderDaysText, isUrgent && { color: '#DC2626' }]}>
                                                {daysLabel}
                                            </Text>
                                        </View>
                                        <Icon name="chevron-right" size={14} color={isUrgent ? '#F87171' : '#C084FC'} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* ═══ MENU UTAMA ═══ */}
                <Text style={styles.sectionTitle}>Menu Utama</Text>

                <View style={isTablet ? styles.tabletMenuGrid : {}}>
                    <MenuItem
                        icon="point-of-sale"
                        title="Buka Kasir (POS)"
                        subtitle="Mulai transaksi penjualan"
                        primary
                        delay={250}
                        onPress={() => navigation.navigate('POS')}
                        style={isTablet ? styles.tabletMenuFull : {}}
                    />

                    {settings.enableTableOrder && (
                        <>
                            {!isTablet && <View style={{ height: 12 }} />}
                            <MenuItem
                                icon="table-chair"
                                title="Order Meja"
                                subtitle="Pesanan QR pelanggan"
                                color="#0F766E"
                                bgColor="#ECFDF5"
                                delay={280}
                                onPress={() => navigation.navigate('TableOrders')}
                                style={isTablet ? styles.tabletMenuHalf : {}}
                            />
                        </>
                    )}

                    {(user?.role === 'ADMIN' || user?.role === 'OWNER') && (
                        <>
                            {!isTablet && <View style={{ height: 12 }} />}
                            <MenuItem
                                icon="chart-box-outline"
                                title="Laporan & Pengeluaran"
                                subtitle="Histori, retur, dan biaya"
                                color={COLORS.primary}
                                bgColor={COLORS.primaryLight}
                                delay={300}
                                onPress={() => navigation.navigate('Laporan')}
                                style={isTablet ? styles.tabletMenuHalf : {}}
                            />

                            {!isTablet && <View style={{ height: 12 }} />}
                            <MenuItem
                                icon="database-outline"
                                title="Kelola Data"
                                subtitle="Produk, kategori & pelanggan"
                                color="#7B61FF"
                                bgColor="#F0EDFF"
                                delay={350}
                                onPress={() => navigation.navigate('Main', { screen: 'Inventori' })}
                                style={isTablet ? styles.tabletMenuHalf : {}}
                            />

                            {!isTablet && <View style={{ height: 12 }} />}
                            <MenuItem
                                icon="account-multiple-outline"
                                title="Kontak & Pelanggan"
                                subtitle="Data pelanggan & supplier"
                                color={COLORS.accent}
                                bgColor={COLORS.accentLight}
                                delay={400}
                                onPress={() => navigation.navigate('Main', { screen: 'Kontak' })}
                                style={isTablet ? styles.tabletMenuHalf : {}}
                            />

                            {settings.enableDineTable && (
                                <>
                                    {!isTablet && <View style={{ height: 12 }} />}
                                    <MenuItem
                                        icon="silverware-fork-knife"
                                        title="Manajemen Meja"
                                        subtitle="Kelola meja dine-in"
                                        color="#059669"
                                        bgColor="#ECFDF5"
                                        delay={450}
                                        onPress={() => navigation.navigate('TableManagement')}
                                        style={isTablet ? styles.tabletMenuHalf : {}}
                                    />
                                </>
                            )}
                        </>
                    )}
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* ═══ PRE-ORDER DETAIL MODAL ═══ */}
            <Modal visible={showPreOrderModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Pre-Order</Text>
                                <Text style={styles.modalSubtitle}>{formatDateDisplay(selectedDate)}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowPreOrderModal(false)}
                                style={styles.modalCloseBtn}
                            >
                                <Icon name="close" size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Info bar */}
                        {(() => {
                            const orderDate = selectedDate ? toLocalDate(selectedDate) : null;
                            const now = new Date(); now.setHours(0, 0, 0, 0);
                            const diffDays = orderDate ? Math.round((orderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 99;
                            const isPickupTime = diffDays <= 0;
                            return (
                                <View style={[styles.modalInfoBar, isPickupTime && { backgroundColor: COLORS.dangerLight }]}>
                                    <Icon
                                        name={isPickupTime ? 'alert' : 'package-variant'}
                                        size={14}
                                        color={isPickupTime ? COLORS.danger : '#7C3AED'}
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={[styles.modalInfoText, isPickupTime && { color: '#B91C1C' }]}>
                                        {isPickupTime
                                            ? `Hari pengambilan! Hubungi pelanggan & konfirmasi di bawah.`
                                            : `${selectedDateOrders.length} pesanan dijadwalkan pada tanggal ini.`}
                                    </Text>
                                </View>
                            );
                        })()}

                        <FlatList
                            data={selectedDateOrders}
                            keyExtractor={(item, idx) => String(item.id || idx)}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8 }}
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                    <Icon name="check-circle" size={40} color={COLORS.accent} />
                                    <Text style={[styles.emptyText, { marginTop: 12 }]}>Semua pesanan sudah dikonfirmasi!</Text>
                                </View>
                            )}
                            renderItem={({ item, index }) => {
                                const orderDate = selectedDate ? toLocalDate(selectedDate) : null;
                                const now = new Date(); now.setHours(0, 0, 0, 0);
                                const diffDays = orderDate ? Math.round((orderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 99;
                                const isPickupTime = diffDays <= 0;
                                const remainingAmount = getRemainingAmount(item);
                                const statusLabel = getPaymentStatusLabel(item.paymentStatus);

                                return (
                                    <View style={[styles.orderItem, index > 0 && { borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                                        <View style={styles.orderRow}>
                                            <View style={styles.orderAvatar}>
                                                <Text style={styles.orderAvatarText}>{index + 1}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.orderName}>{item.customerName || 'Pelanggan Umum'}</Text>
                                                <Text style={styles.orderInvoice}>{item.invoiceNumber}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.orderTotal}>{formatRp(item.grandTotal)}</Text>
                                                <View style={getOrderStatusBadgeStyle(item.paymentStatus)}>
                                                    <Text style={getOrderStatusTextStyle(item.paymentStatus)}>{statusLabel}</Text>
                                                </View>
                                                {remainingAmount > 0 ? (
                                                    <Text style={styles.orderRemainingText}>Sisa {formatRp(remainingAmount)}</Text>
                                                ) : null}
                                            </View>
                                        </View>

                                        {isPickupTime && (
                                            <View style={styles.orderActions}>
                                                {item.customerPhone ? (
                                                    <TouchableOpacity
                                                        style={styles.waBtn}
                                                        onPress={() => openWhatsApp(item)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Icon name="phone" size={14} color={COLORS.white} />
                                                        <Text style={styles.waBtnText}>Hubungi WA</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.waDisabledBtn}
                                                        onPress={() => Alert.alert('Tidak ada nomor', `"${item.customerName}" tidak memiliki nomor HP.`)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Icon name="phone" size={14} color={COLORS.textMuted} />
                                                        <Text style={styles.waDisabledText}>Tidak ada WA</Text>
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                    style={styles.confirmBtn}
                                                    onPress={() => confirmOrder(item)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Icon name="check-circle" size={14} color={COLORS.white} />
                                                    <Text style={styles.confirmBtnText}>Konfirmasi</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            }}
                        />

                        {selectedDateOrders.length > 0 && (
                            <View style={styles.modalFooter}>
                                <Text style={styles.modalFooterLabel}>
                                    Total ({selectedDateOrders.length} pesanan)
                                </Text>
                                <Text style={styles.modalFooterValue}>
                                    {formatRp(selectedDateOrders.reduce((s, o) => s + (o.grandTotal || 0), 0))}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ═══ CLOSE SHIFT MODAL ═══ */}
            {pickupPaymentOrder ? (
                <Modal visible={!!pickupPaymentOrder} transparent animationType="fade">
                    <View style={styles.shiftModalOverlay}>
                        <View style={styles.shiftModalCard}>
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <View style={[styles.shiftModalIcon, { backgroundColor: COLORS.warningLight }]}>
                                    <Icon name="cash-check" size={28} color={COLORS.warning} />
                                </View>
                                <Text style={styles.shiftModalTitle}>Pelunasan Pre-Order</Text>
                                <Text style={styles.shiftModalSub}>
                                    {pickupPaymentOrder.customerName || 'Pelanggan Umum'} - {pickupPaymentOrder.invoiceNumber}
                                </Text>
                            </View>

                            <View style={styles.pickupPaymentSummary}>
                                <View style={styles.pickupPaymentRow}>
                                    <Text style={styles.pickupPaymentLabel}>Total</Text>
                                    <Text style={styles.pickupPaymentValue}>{formatRp(pickupPaymentOrder.grandTotal || 0)}</Text>
                                </View>
                                <View style={styles.pickupPaymentRow}>
                                    <Text style={styles.pickupPaymentLabel}>Sudah dibayar</Text>
                                    <Text style={styles.pickupPaymentValue}>{formatRp(getPaidAmount(pickupPaymentOrder))}</Text>
                                </View>
                                <View style={styles.pickupPaymentRow}>
                                    <Text style={styles.pickupPaymentLabel}>Sisa bayar</Text>
                                    <Text style={[styles.pickupPaymentValue, { color: COLORS.danger }]}>{formatRp(getRemainingAmount(pickupPaymentOrder))}</Text>
                                </View>
                            </View>

                            <Text style={styles.shiftInputLabel}>Metode Pelunasan</Text>
                            <View style={styles.pickupMethodRow}>
                                {['CASH', 'QRIS', 'TRANSFER'].map(method => (
                                    <TouchableOpacity
                                        key={method}
                                        style={[styles.pickupMethodBtn, pickupPaymentMethod === method && styles.pickupMethodBtnActive]}
                                        onPress={() => setPickupPaymentMethod(method)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.pickupMethodText, pickupPaymentMethod === method && styles.pickupMethodTextActive]}>
                                            {method === 'CASH' ? 'TUNAI' : method}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {pickupPaymentMethod === 'CASH' ? (
                                <>
                                    <Text style={styles.shiftInputLabel}>Tunai Diterima</Text>
                                    <View style={styles.shiftInputWrap}>
                                        <View style={styles.shiftInputPrefix}>
                                            <Text style={styles.shiftInputPrefixText}>Rp</Text>
                                        </View>
                                        <TextInput
                                            style={styles.shiftCashInput}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={COLORS.textMuted}
                                            value={pickupCashAmount ? parseInt(pickupCashAmount.replace(/[^0-9]/g, '') || '0').toLocaleString('id-ID') : ''}
                                            onChangeText={t => setPickupCashAmount(t.replace(/[^0-9]/g, ''))}
                                        />
                                    </View>
                                    {parseInt(pickupCashAmount.replace(/\D/g, '') || '0', 10) >= getRemainingAmount(pickupPaymentOrder) ? (
                                        <Text style={styles.pickupChangeText}>
                                            Kembalian {formatRp(parseInt(pickupCashAmount.replace(/\D/g, '') || '0', 10) - getRemainingAmount(pickupPaymentOrder))}
                                        </Text>
                                    ) : null}
                                </>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.shiftConfirmBtn, { backgroundColor: COLORS.accent }]}
                                onPress={confirmPickupPayment}
                            >
                                <Text style={styles.shiftConfirmBtnText}>Simpan Pelunasan</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setPickupPaymentOrder(null)}>
                                <Text style={styles.shiftCancelText}>Batal</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            ) : null}

            <Modal visible={showCloseShiftModal} transparent animationType="fade">
                <View style={styles.shiftModalOverlay}>
                    <View style={styles.shiftModalCard}>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <View style={styles.shiftModalIcon}>
                                <Icon name="lock" size={28} color={COLORS.danger} />
                            </View>
                            <Text style={styles.shiftModalTitle}>Tutup Shift</Text>
                            {activeShift && (
                                <Text style={styles.shiftModalSub}>
                                    Kas awal: Rp {activeShift.openingCash.toLocaleString('id-ID')}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.shiftInputLabel}>Kas Akhir (Rp)</Text>
                        <View style={styles.shiftInputWrap}>
                            <View style={styles.shiftInputPrefix}>
                                <Text style={styles.shiftInputPrefixText}>Rp</Text>
                            </View>
                            <TextInput
                                style={styles.shiftCashInput}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={COLORS.textMuted}
                                value={closingCashInput ? parseInt(closingCashInput.replace(/[^0-9]/g, '') || '0').toLocaleString('id-ID') : ''}
                                onChangeText={t => setClosingCashInput(t.replace(/[^0-9]/g, ''))}
                                autoFocus
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.shiftConfirmBtn}
                            onPress={confirmCloseShift}
                        >
                            <Text style={styles.shiftConfirmBtnText}>Tutup Shift Sekarang</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setShowCloseShiftModal(false)}>
                            <Text style={styles.shiftCancelText}>Batal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const getStyles = (COLORS: any) => StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 12 : 56,
        paddingBottom: 12,
        backgroundColor: COLORS.bg,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    greeting: {
        ...FONTS.regular,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    ownerName: {
        ...FONTS.bold,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notifBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 3,
    },
    notifBadge: {
        position: 'absolute',
        top: -3,
        right: -5,
        minWidth: 19,
        height: 19,
        paddingHorizontal: 4,
        borderRadius: 10,
        backgroundColor: COLORS.danger,
        borderWidth: 2,
        borderColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notifBadgeText: {
        ...FONTS.bold,
        color: '#FFFFFF',
        fontSize: 9,
        lineHeight: 11,
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.dangerLight,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

    // Shift Banner (closed)
    shiftBannerClosed: {
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
    },
    shiftClosedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    shiftIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    shiftClosedTitleBlock: { flex: 1 },
    shiftClosedTitle: {
        ...FONTS.bold,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    shiftClosedSub: {
        ...FONTS.regular,
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    shiftInactiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    shiftInactiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.warning,
        marginRight: 5,
    },
    shiftInactiveText: {
        ...FONTS.bold,
        fontSize: 9,
        color: COLORS.warning,
    },
    shiftInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shiftInputWrapCompact: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 9,
        backgroundColor: COLORS.bg,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    shiftInputPrefixCompact: {
        ...FONTS.bold,
        fontSize: 12,
        color: COLORS.textSecondary,
        marginRight: 8,
    },
    shiftInput: {
        flex: 1,
        padding: 0,
        ...FONTS.bold,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    shiftOpenBtn: {
        width: 94,
        height: 44,
        marginLeft: 10,
        backgroundColor: COLORS.primary,
        borderRadius: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shiftOpenBtnText: {
        ...FONTS.bold,
        fontSize: 12,
        color: '#FFFFFF',
        marginLeft: 5,
    },

    // Shift Banner (active)
    shiftBannerActive: {
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
    },
    shiftActiveTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    shiftActiveIdentity: { flex: 1 },
    shiftActiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    shiftActiveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        marginRight: 6,
    },
    shiftActiveBadgeText: {
        ...FONTS.bold,
        fontSize: 10,
        color: COLORS.accent,
    },
    shiftActiveLabel: {
        ...FONTS.regular,
        fontSize: 11,
        color: COLORS.textSecondary,
    },
    shiftCloseBtn: {
        borderWidth: 1,
        borderColor: COLORS.danger,
        paddingHorizontal: 10,
        height: 34,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shiftCloseBtnText: {
        ...FONTS.bold,
        fontSize: 11,
        color: COLORS.danger,
    },
    shiftBalanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
    },
    shiftBalanceLabel: {
        ...FONTS.bold,
        fontSize: 11,
        color: COLORS.textPrimary,
    },
    shiftBalanceHint: {
        ...FONTS.regular,
        fontSize: 9,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    shiftBreakdown: {
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingTop: 11,
    },
    shiftMetric: {
        flex: 1,
        minWidth: 0,
    },
    shiftMetricDivider: {
        width: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: 9,
    },
    shiftRowLabel: {
        ...FONTS.regular,
        fontSize: 9,
        color: COLORS.textSecondary,
        marginBottom: 3,
    },
    shiftRowValue: {
        ...FONTS.bold,
        fontSize: 11,
        color: COLORS.textPrimary,
    },
    shiftSalesValue: { color: COLORS.accent },
    shiftExpenseValue: { color: COLORS.danger },
    shiftTotalValue: {
        ...FONTS.bold,
        fontSize: 17,
        color: COLORS.primary,
        maxWidth: '46%',
        textAlign: 'right',
    },

    // Hero Card
    heroCard: {
        backgroundColor: COLORS.primary,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
    },
    heroBlob1: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: COLORS.primaryMid,
        opacity: 0.5,
        top: -60,
        right: -40,
    },
    heroBlob2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primaryDeep,
        opacity: 0.6,
        bottom: -30,
        left: 20,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    heroLabel: {
        ...FONTS.medium,
        fontSize: 12,
        color: COLORS.white + 'CC',
        marginBottom: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    heroValue: {
        ...FONTS.bold,
        fontSize: 30,
        color: COLORS.white,
        letterSpacing: -0.5,
    },
    heroBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white + '22',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
        borderWidth: 1,
        borderColor: COLORS.white + '33',
    },
    heroBtnText: {
        ...FONTS.semibold,
        fontSize: 12,
        color: COLORS.white,
        marginLeft: 4,
    },
    heroDivider: {
        height: 1,
        backgroundColor: COLORS.white + '22',
        marginVertical: 14,
    },
    heroBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    heroStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroStatTextGreen: {
        ...FONTS.medium,
        fontSize: 12,
        color: COLORS.accent,
        marginLeft: 4,
    },
    heroStatTextMuted: {
        ...FONTS.medium,
        fontSize: 12,
        color: COLORS.white + 'AA',
        marginLeft: 4,
    },

    // Stat cards
    statsRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    statCard: {
        borderRadius: 16,
        padding: 14,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 3,
    },
    statIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statLabel: {
        ...FONTS.medium,
        fontSize: 10,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    statValue: {
        ...FONTS.bold,
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    statSub: {
        ...FONTS.regular,
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 1,
    },

    // Pending Alert
    pendingAlert: {
        backgroundColor: COLORS.warningLight,
        borderWidth: 1,
        borderColor: '#FBBF24',
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    pendingBadge: {
        width: 40,
        height: 40,
        backgroundColor: '#FEF3C7',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    pendingBadgeText: {
        ...FONTS.bold,
        fontSize: 14,
        color: '#B45309',
    },
    pendingTitle: {
        ...FONTS.bold,
        fontSize: 14,
        color: '#92400E',
    },
    pendingSub: {
        ...FONTS.regular,
        fontSize: 12,
        color: '#B45309',
    },

    // Pre-order
    preOrderCard: {
        backgroundColor: '#FAF5FF',
        borderWidth: 1,
        borderColor: '#E9D5FF',
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
    },
    preOrderHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3E8FF',
    },
    preOrderIconWrap: {
        width: 32,
        height: 32,
        backgroundColor: '#EDE9FE',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    preOrderHeaderTitle: {
        ...FONTS.bold,
        fontSize: 14,
        color: '#581C87',
    },
    preOrderHeaderSub: {
        ...FONTS.regular,
        fontSize: 12,
        color: '#7C3AED',
    },
    preOrderRow: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    preOrderDate: {
        ...FONTS.bold,
        fontSize: 14,
        color: '#581C87',
        marginRight: 8,
    },
    preOrderBadge: {
        backgroundColor: '#E9D5FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    preOrderBadgeText: {
        ...FONTS.bold,
        fontSize: 10,
        color: '#6D28D9',
    },
    preOrderCustomers: {
        ...FONTS.regular,
        fontSize: 12,
        color: '#A78BFA',
    },
    preOrderDaysBadge: {
        backgroundColor: '#EDE9FE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        marginRight: 4,
    },
    preOrderDaysText: {
        ...FONTS.bold,
        fontSize: 12,
        color: '#6D28D9',
    },

    // Section
    sectionTitle: {
        ...FONTS.bold,
        fontSize: 16,
        color: COLORS.textPrimary,
        marginBottom: 12,
    },

    // Menu Item (Primary)
    menuItemPrimary: {
        backgroundColor: COLORS.primary,
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 10,
    },
    blobTL: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.white + '14',
        top: -40,
        left: -20,
    },
    blobBR: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.primaryMid + '55',
        bottom: -30,
        right: 70,
    },
    menuTitlePrimary: {
        ...FONTS.bold,
        fontSize: 18,
        color: COLORS.white,
        marginBottom: 2,
    },
    menuSubPrimary: {
        ...FONTS.regular,
        fontSize: 13,
        color: COLORS.white + 'BB',
    },
    menuIconWrapPrimary: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Menu Item (Regular)
    menuItem: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    menuIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    menuTitle: {
        ...FONTS.semibold,
        fontSize: 15,
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    menuSub: {
        ...FONTS.regular,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    menuChevron: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: COLORS.bg,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Modal common
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalTitle: {
        ...FONTS.bold,
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    modalSubtitle: {
        ...FONTS.bold,
        fontSize: 14,
        color: COLORS.primary,
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 8,
        backgroundColor: COLORS.bg,
        borderRadius: 20,
    },
    modalInfoBar: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FAF5FF',
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalInfoText: {
        ...FONTS.bold,
        fontSize: 13,
        flex: 1,
        color: '#6D28D9',
    },
    emptyText: {
        ...FONTS.bold,
        fontSize: 14,
        color: COLORS.textSecondary,
    },

    // Order items in modal
    orderItem: {
        paddingVertical: 16,
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    orderAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EDE9FE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    orderAvatarText: {
        ...FONTS.bold,
        fontSize: 14,
        color: '#6D28D9',
    },
    orderName: {
        ...FONTS.bold,
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    orderInvoice: {
        ...FONTS.regular,
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    orderTotal: {
        ...FONTS.bold,
        fontSize: 14,
        color: COLORS.primary,
    },
    orderStatusBadge: {
        backgroundColor: COLORS.accentLight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginTop: 4,
    },
    orderStatusText: {
        ...FONTS.bold,
        fontSize: 10,
        color: '#15803D',
    },
    orderRemainingText: {
        ...FONTS.semibold,
        fontSize: 10,
        color: COLORS.danger,
        marginTop: 3,
    },
    orderActions: {
        flexDirection: 'row',
        gap: 8,
    },
    waBtn: {
        flex: 1,
        backgroundColor: COLORS.accent,
        paddingVertical: 10,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    waBtnText: {
        ...FONTS.bold,
        fontSize: 12,
        color: COLORS.white,
        marginLeft: 6,
    },
    waDisabledBtn: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingVertical: 10,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    waDisabledText: {
        ...FONTS.bold,
        fontSize: 12,
        color: COLORS.textMuted,
        marginLeft: 6,
    },
    confirmBtn: {
        flex: 1,
        backgroundColor: COLORS.primary,
        paddingVertical: 10,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtnText: {
        ...FONTS.bold,
        fontSize: 12,
        color: COLORS.white,
        marginLeft: 6,
    },
    modalFooter: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalFooterLabel: {
        ...FONTS.semibold,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    modalFooterValue: {
        ...FONTS.bold,
        fontSize: 16,
        color: COLORS.textPrimary,
    },

    pickupPaymentSummary: {
        backgroundColor: COLORS.bg,
        borderRadius: 16,
        padding: 14,
        marginBottom: 18,
    },
    pickupPaymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    pickupPaymentLabel: {
        ...FONTS.semibold,
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    pickupPaymentValue: {
        ...FONTS.bold,
        fontSize: 13,
        color: COLORS.textPrimary,
    },
    pickupMethodRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    pickupMethodBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        backgroundColor: COLORS.bg,
    },
    pickupMethodBtnActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    pickupMethodText: {
        ...FONTS.bold,
        fontSize: 11,
        color: COLORS.textSecondary,
    },
    pickupMethodTextActive: {
        color: COLORS.primary,
    },
    pickupChangeText: {
        ...FONTS.bold,
        fontSize: 13,
        color: COLORS.accent,
        marginTop: -12,
        marginBottom: 16,
        textAlign: 'right',
    },

    // Close Shift Modal
    shiftModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    shiftModalCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 24,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 24,
    },
    shiftModalIcon: {
        width: 64,
        height: 64,
        backgroundColor: COLORS.dangerLight,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    shiftModalTitle: {
        ...FONTS.bold,
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    shiftModalSub: {
        ...FONTS.regular,
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 4,
        textAlign: 'center',
    },
    shiftInputLabel: {
        ...FONTS.bold,
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    shiftInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    shiftInputPrefix: {
        backgroundColor: COLORS.dangerLight,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
    },
    shiftInputPrefixText: {
        ...FONTS.bold,
        fontSize: 16,
        color: COLORS.danger,
    },
    shiftCashInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        ...FONTS.bold,
        fontSize: 20,
        color: COLORS.textPrimary,
    },
    shiftConfirmBtn: {
        backgroundColor: COLORS.danger,
        paddingVertical: 16,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 12,
    },
    shiftConfirmBtnText: {
        ...FONTS.bold,
        fontSize: 16,
        color: COLORS.white,
    },
    shiftCancelText: {
        ...FONTS.bold,
        fontSize: 14,
        color: COLORS.textMuted,
    },
    tabletHeroRow: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    tabletStatColumn: {
        flex: 1,
    },
    tabletHeroCard: {
        flex: 2,
        marginRight: 16,
        marginBottom: 0,
        minHeight: 188,
        alignSelf: 'flex-start',
        padding: 22,
    },
    tabletHeroTitleBlock: {
        flex: 1,
        marginRight: 14,
    },
    tabletHeroValue: {
        fontSize: 34,
    },
    tabletHeroFooter: {
        marginTop: 24,
    },
    tabletHeroBottom: {
        gap: 10,
    },
    tabletHeroStatPill: {
        flexShrink: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        backgroundColor: COLORS.white + '1A',
        borderWidth: 1,
        borderColor: COLORS.white + '24',
    },
    tabletHeroStatText: {
        flexShrink: 1,
    },
    tabletMenuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    tabletMenuFull: {
        width: '100%',
        marginBottom: 16,
    },
    tabletMenuHalf: {
        width: '48%',
        marginBottom: 16,
    },
});
