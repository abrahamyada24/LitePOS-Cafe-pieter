import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import tw, { useAppColorScheme } from 'twrnc';
import api from '../services/api';
import { useStore } from '../store/useStore';

type KitchenStatus = 'NEW' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
type KitchenFilter = 'ALL' | KitchenStatus;

type KitchenItem = {
    productId?: number;
    packageId?: number;
    name: string;
    qty?: number;
    quantity?: number;
    notes?: string;
    components?: Array<{ name: string; qty?: number; quantity?: number }>;
};

type KitchenOrder = {
    id: string;
    source: string;
    orderCode: string;
    queueLabel: string;
    tableNumber?: string | null;
    customerName?: string | null;
    note?: string | null;
    total: number | string;
    items: KitchenItem[];
    status: KitchenStatus;
    paymentStatus?: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';
    createdAt: string;
};

const STATUS_META: Record<KitchenStatus, {
    label: string;
    icon: string;
    color: string;
    light: string;
    next?: KitchenStatus;
    action?: string;
}> = {
    NEW: { label: 'Baru', icon: 'clock-outline', color: '#D97706', light: '#FFFBEB', next: 'PREPARING', action: 'Mulai Masak' },
    PREPARING: { label: 'Diproses', icon: 'fire', color: '#2563EB', light: '#EFF6FF', next: 'READY', action: 'Tandai Siap' },
    READY: { label: 'Siap', icon: 'check-circle-outline', color: '#059669', light: '#ECFDF5', next: 'COMPLETED', action: 'Selesaikan' },
    COMPLETED: { label: 'Selesai', icon: 'check-all', color: '#4B5563', light: '#F3F4F6' },
    CANCELLED: { label: 'Dibatalkan', icon: 'close-circle-outline', color: '#DC2626', light: '#FEF2F2' },
};

const PAYMENT_META = {
    UNPAID: { label: 'Belum dibayar', color: '#DC2626', light: '#FEF2F2' },
    PENDING: { label: 'Menunggu bayar', color: '#D97706', light: '#FFFBEB' },
    PAID: { label: 'Sudah dibayar', color: '#059669', light: '#ECFDF5' },
    FAILED: { label: 'Pembayaran gagal', color: '#4B5563', light: '#F3F4F6' },
};

const ACTIVE_STATUSES: KitchenStatus[] = ['NEW', 'PREPARING', 'READY'];
const HISTORY_STATUSES: KitchenStatus[] = ['COMPLETED', 'CANCELLED'];

const formatRp = (value: number | string) => `Rp ${Math.round(Number(value || 0)).toLocaleString('id-ID')}`;

const formatElapsed = (createdAt: string, now: number) => {
    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) return '-';
    const minutes = Math.max(0, Math.floor((now - created) / 60000));
    return minutes < 60 ? `${minutes} mnt` : `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
};

export default function KitchenQueueScreen({ navigation }: any) {
    useAppColorScheme(tw);
    const settings = useStore(state => state.settings);
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [includeCompleted, setIncludeCompleted] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<KitchenFilter>('ALL');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now());

    const loadOrders = useCallback(async (silent = false) => {
        if (!settings.enableKitchenQueue) {
            setOrders([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (!silent) setError('');
        try {
            const response = await api.get('/kitchen-orders', {
                params: { includeCompleted },
            });
            const rows = Array.isArray(response.data?.data) ? response.data.data : [];
            setOrders(rows.map((order: any) => ({
                ...order,
                total: Number(order.total || 0),
                items: Array.isArray(order.items) ? order.items : [],
            })));
            setError('');
        } catch (requestError: any) {
            if (!silent) {
                setError(requestError?.response?.data?.message || 'Antrean dapur belum dapat dimuat.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [includeCompleted, settings.enableKitchenQueue]);

    useEffect(() => {
        loadOrders();
        const unsubscribe = navigation.addListener('focus', () => loadOrders(true));
        const poll = setInterval(() => loadOrders(true), 5000);
        const clock = setInterval(() => setNow(Date.now()), 30000);
        return () => {
            unsubscribe();
            clearInterval(poll);
            clearInterval(clock);
        };
    }, [loadOrders, navigation]);

    useEffect(() => {
        if (!includeCompleted && selectedStatus !== 'ALL' && HISTORY_STATUSES.includes(selectedStatus)) {
            setSelectedStatus('ALL');
        }
    }, [includeCompleted, selectedStatus]);

    const counts = useMemo(() => Object.fromEntries(
        [...ACTIVE_STATUSES, ...HISTORY_STATUSES].map(status => [
            status,
            orders.filter(order => order.status === status).length,
        ]),
    ) as Record<KitchenStatus, number>, [orders]);

    const filteredOrders = useMemo(() => selectedStatus === 'ALL'
        ? orders
        : orders.filter(order => order.status === selectedStatus), [orders, selectedStatus]);

    const updateStatus = async (order: KitchenOrder, status: KitchenStatus) => {
        setUpdatingId(order.id);
        try {
            const response = await api.patch(`/kitchen-orders/${order.id}/status`, { status });
            if (!response.data?.success) throw new Error(response.data?.message || 'Status belum berubah.');
            await loadOrders(true);
        } catch (requestError: any) {
            Alert.alert(
                'Status Belum Berubah',
                requestError?.response?.data?.message || requestError?.message || 'Periksa koneksi lalu coba lagi.',
            );
        } finally {
            setUpdatingId(null);
        }
    };

    const cancelOrder = (order: KitchenOrder) => {
        Alert.alert(
            'Batalkan Pesanan?',
            `${order.queueLabel}${order.tableNumber ? ` - Meja ${order.tableNumber}` : ''} akan dibatalkan dan tidak dapat diproses di kasir.`,
            [
                { text: 'Kembali', style: 'cancel' },
                {
                    text: 'Batalkan Pesanan',
                    style: 'destructive',
                    onPress: () => updateStatus(order, 'CANCELLED'),
                },
            ],
        );
    };

    const renderOrder = ({ item: order }: { item: KitchenOrder }) => {
        const status = STATUS_META[order.status] || STATUS_META.NEW;
        const paymentKey = order.paymentStatus || 'UNPAID';
        const payment = PAYMENT_META[paymentKey] || PAYMENT_META.UNPAID;
        const isUpdating = updatingId === order.id;

        return (
            <View style={tw`mx-4 mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800`}>
                <View style={tw`p-4`}>
                    <View style={tw`flex-row items-start justify-between`}>
                        <View style={tw`flex-1 flex-row items-start pr-3`}>
                            <View style={[tw`mr-3 min-w-20 items-center rounded-xl px-3 py-2`, { backgroundColor: status.light }]}>
                                <Text style={[tw`text-xl font-black`, { color: status.color }]}>{order.queueLabel}</Text>
                                <Text style={[tw`text-[9px] font-black uppercase`, { color: status.color }]}>{status.label}</Text>
                            </View>
                            <View style={tw`flex-1`}>
                                <Text style={tw`text-base font-black text-gray-900 dark:text-white`}>
                                    {order.tableNumber ? `Meja ${order.tableNumber}` : 'Pesanan Kasir'}
                                </Text>
                                <Text style={tw`mt-0.5 text-xs text-gray-500 dark:text-gray-400`} numberOfLines={1}>
                                    {order.customerName || order.source}
                                </Text>
                                <View style={tw`mt-2 flex-row items-center`}>
                                    <Icon name="clock-outline" size={13} color={tw.color('gray-400')} />
                                    <Text style={tw`ml-1 text-[11px] font-bold text-gray-400`}>{formatElapsed(order.createdAt, now)}</Text>
                                </View>
                            </View>
                        </View>
                        <View style={[tw`rounded-lg px-2 py-1`, { backgroundColor: payment.light }]}>
                            <Text style={[tw`text-[9px] font-black uppercase`, { color: payment.color }]}>{payment.label}</Text>
                        </View>
                    </View>

                    <View style={tw`mt-4 border-t border-gray-100 pt-3 dark:border-gray-700`}>
                        {order.items.map((item, index) => (
                            <View key={`${item.productId || item.packageId || index}-${index}`} style={tw`mb-2 flex-row items-start`}>
                                <Text style={tw`w-9 text-sm font-black text-gray-800 dark:text-gray-100`}>
                                    {Number(item.qty || item.quantity || 1)}x
                                </Text>
                                <View style={tw`flex-1`}>
                                    <Text style={tw`text-sm font-bold text-gray-800 dark:text-gray-100`}>{item.name}</Text>
                                    {item.components?.length ? (
                                        <Text style={tw`mt-0.5 text-[11px] text-gray-500 dark:text-gray-400`}>
                                            {item.components.map(component => `${component.name} x${component.qty || component.quantity || 1}`).join(', ')}
                                        </Text>
                                    ) : null}
                                    {item.notes ? (
                                        <Text style={tw`mt-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300`}>{item.notes}</Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>

                    {order.note ? (
                        <View style={tw`mt-1 flex-row items-start rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/30`}>
                            <Icon name="note-text-outline" size={15} color={tw.color('amber-700')} style={tw`mr-2 mt-0.5`} />
                            <Text style={tw`flex-1 text-xs font-bold text-amber-800 dark:text-amber-200`}>{order.note}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={tw`flex-row items-center border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900`}>
                    <View style={tw`flex-1`}>
                        <Text style={tw`text-[9px] font-bold uppercase text-gray-400`}>Total</Text>
                        <Text style={tw`text-sm font-black text-gray-900 dark:text-white`}>{formatRp(order.total)}</Text>
                    </View>
                    {status.next ? (
                        <View style={tw`flex-row items-center`}>
                            {paymentKey === 'UNPAID' ? (
                                <TouchableOpacity
                                    accessibilityLabel="Batalkan pesanan"
                                    disabled={isUpdating}
                                    onPress={() => cancelOrder(order)}
                                    style={tw`mr-2 h-11 w-11 items-center justify-center rounded-lg border border-red-200 dark:border-red-900`}
                                >
                                    <Icon name="close" size={20} color={tw.color('red-500')} />
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                disabled={isUpdating}
                                onPress={() => updateStatus(order, status.next as KitchenStatus)}
                                style={[tw`h-11 min-w-32 flex-row items-center justify-center rounded-lg px-4`, { backgroundColor: status.color }, isUpdating && tw`opacity-60`]}
                            >
                                {isUpdating ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Icon name={status.icon} size={17} color="white" />
                                        <Text style={tw`ml-2 text-xs font-black text-white`}>{status.action}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </View>
        );
    };

    const availableFilters: KitchenFilter[] = includeCompleted
        ? ['ALL', ...ACTIVE_STATUSES, ...HISTORY_STATUSES]
        : ['ALL', ...ACTIVE_STATUSES];

    return (
        <View style={tw`flex-1 bg-gray-50 dark:bg-gray-950`}>
            <View style={tw`flex-row items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900`}>
                <TouchableOpacity
                    accessibilityLabel="Kembali"
                    onPress={() => navigation.goBack()}
                    style={tw`mr-3 h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800`}
                >
                    <Icon name="arrow-left" size={21} color={tw.color('gray-700')} />
                </TouchableOpacity>
                <View style={tw`flex-1`}>
                    <Text style={tw`text-lg font-black text-gray-900 dark:text-white`}>Antrean Dapur</Text>
                    <Text style={tw`text-xs text-gray-500 dark:text-gray-400`}>Pesanan hari ini, urut nomor antrean</Text>
                </View>
                <TouchableOpacity
                    accessibilityLabel="Tampilkan riwayat"
                    onPress={() => setIncludeCompleted(value => !value)}
                    style={tw`mr-2 h-10 flex-row items-center rounded-lg border px-3 ${includeCompleted ? 'border-gray-900 bg-gray-900 dark:border-blue-600 dark:bg-blue-600' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'}`}
                >
                    <Icon name="history" size={17} color={includeCompleted ? tw.color('white') : tw.color('gray-600')} />
                    <Text style={tw`ml-1.5 text-xs font-black ${includeCompleted ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>Riwayat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityLabel="Muat ulang"
                    onPress={() => {
                        setRefreshing(true);
                        loadOrders();
                    }}
                    style={tw`h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700`}
                >
                    <Icon name="refresh" size={20} color={tw.color('blue-600')} />
                </TouchableOpacity>
            </View>

            {!settings.enableKitchenQueue ? (
                <View style={tw`flex-1 items-center justify-center px-8`}>
                    <View style={tw`mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800`}>
                        <Icon name="chef-hat" size={32} color={tw.color('gray-400')} />
                    </View>
                    <Text style={tw`text-center text-lg font-black text-gray-800 dark:text-gray-100`}>Antrean dapur tidak aktif</Text>
                    <Text style={tw`mt-2 text-center text-sm text-gray-500 dark:text-gray-400`}>Owner atau Admin dapat mengaktifkannya dari Pengaturan Fitur.</Text>
                </View>
            ) : loading ? (
                <View style={tw`flex-1 items-center justify-center`}>
                    <ActivityIndicator size="large" color={tw.color('blue-600')} />
                </View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    keyExtractor={item => item.id}
                    renderItem={renderOrder}
                    refreshControl={(
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadOrders();
                            }}
                            colors={[tw.color('blue-600') || '#2563EB']}
                        />
                    )}
                    contentContainerStyle={filteredOrders.length === 0 ? tw`flex-grow pb-8` : tw`pb-8`}
                    ListHeaderComponent={(
                        <View>
                            <View style={tw`mx-4 my-4 flex-row overflow-hidden rounded-xl bg-gray-900 dark:bg-gray-800`}>
                                {ACTIVE_STATUSES.map((status, index) => {
                                    const meta = STATUS_META[status];
                                    return (
                                        <View key={status} style={tw`flex-1 items-center py-3 ${index > 0 ? 'border-l border-gray-700' : ''}`}>
                                            <Text style={tw`text-[9px] font-black uppercase text-gray-300`}>{meta.label}</Text>
                                            <Text style={tw`mt-0.5 text-xl font-black text-white`}>{counts[status] || 0}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`px-4 pb-4`}>
                                {availableFilters.map(filter => {
                                    const active = selectedStatus === filter;
                                    const label = filter === 'ALL' ? 'Semua' : STATUS_META[filter].label;
                                    const count = filter === 'ALL' ? orders.length : counts[filter] || 0;
                                    return (
                                        <TouchableOpacity
                                            key={filter}
                                            onPress={() => setSelectedStatus(filter)}
                                            style={tw`mr-2 flex-row items-center rounded-full border px-3 py-2 ${active ? 'border-blue-600 bg-blue-600' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'}`}
                                        >
                                            <Text style={tw`text-xs font-black ${active ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{label}</Text>
                                            <View style={tw`ml-2 min-w-5 items-center rounded-full px-1.5 py-0.5 ${active ? 'bg-blue-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                <Text style={tw`text-[9px] font-black ${active ? 'text-white' : 'text-gray-500 dark:text-gray-300'}`}>{count}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={tw`flex-1 items-center justify-center px-8 pb-24`}>
                            <View style={tw`mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30`}>
                                <Icon name="chef-hat" size={30} color={tw.color('emerald-600')} />
                            </View>
                            <Text style={tw`text-center text-lg font-black text-gray-800 dark:text-gray-100`}>Tidak ada pesanan</Text>
                            <Text style={tw`mt-2 text-center text-sm text-gray-500 dark:text-gray-400`}>
                                {error || 'Daftar akan diperbarui otomatis setiap 5 detik.'}
                            </Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}
