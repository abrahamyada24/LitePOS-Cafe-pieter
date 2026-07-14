import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import tw, { useAppColorScheme } from 'twrnc';
import api from '../services/api';
import { useStore } from '../store/useStore';

type TableOrderPayload = {
    source?: string;
    orderCode?: string;
    queueDate?: string;
    queueNumber?: number;
    queueLabel?: string;
    tableNumber?: string;
    customerName?: string;
    note?: string;
    grandTotal?: number;
    items: any[];
};

type TableOrder = {
    id: string;
    name: string;
    cartData: string;
    createdAt: string;
    source: 'server';
    payload: TableOrderPayload;
};

const parsePayload = (cartData: string): TableOrderPayload | null => {
    try {
        const parsed = typeof cartData === 'string' ? JSON.parse(cartData) : cartData;
        if (!parsed || Array.isArray(parsed)) return null;
        if (parsed.source !== 'TABLE_QR' && !parsed.tableNumber) return null;
        return {
            ...parsed,
            items: Array.isArray(parsed.items) ? parsed.items : [],
        };
    } catch {
        return null;
    }
};

const formatRp = (value: number) => `Rp ${Math.round(value || 0).toLocaleString('id-ID')}`;

const formatOrderTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function TableOrdersScreen({ navigation }: any) {
    useAppColorScheme(tw);
    const settings = useStore(state => state.settings);
    const [orders, setOrders] = useState<TableOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadOrders = useCallback(async (silent = false) => {
        if (!settings.enableTableOrder) {
            setOrders([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (!silent) setError('');
        try {
            const response = await api.get('/saved-transactions');
            const rows = Array.isArray(response.data?.data) ? response.data.data : [];
            const tableOrders: TableOrder[] = rows.reduce((result: TableOrder[], row: any) => {
                const payload = parsePayload(row.cartData);
                if (payload) {
                    result.push({ ...row, source: 'server', payload });
                }
                return result;
            }, []);
            tableOrders.sort((left, right) => {
                const leftDate = left.payload.queueDate || left.createdAt.slice(0, 10);
                const rightDate = right.payload.queueDate || right.createdAt.slice(0, 10);
                const dateOrder = leftDate.localeCompare(rightDate);
                const leftNumber = Number(left.payload.queueNumber || Number.MAX_SAFE_INTEGER);
                const rightNumber = Number(right.payload.queueNumber || Number.MAX_SAFE_INTEGER);
                return dateOrder || leftNumber - rightNumber || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            });
            setOrders(tableOrders);
            setError('');
        } catch (requestError: any) {
            if (!silent) {
                setError(requestError?.response?.data?.message || 'Order belum dapat dimuat.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [settings.enableTableOrder]);

    useEffect(() => {
        loadOrders();
        const unsubscribe = navigation.addListener('focus', () => loadOrders(true));
        const interval = setInterval(() => loadOrders(true), 15000);
        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [loadOrders, navigation]);

    const processOrder = (order: TableOrder) => {
        navigation.navigate('POS', {
            pendingOrder: {
                id: order.id,
                name: order.name,
                cartData: order.cartData,
                createdAt: order.createdAt,
                source: 'server',
            },
        });
    };

    const rejectOrder = (order: TableOrder) => {
        Alert.alert(
            'Tolak Order',
            `Hapus order ${order.payload.tableNumber || order.name}?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Tolak',
                    style: 'destructive',
                    onPress: async () => {
                        setDeletingId(order.id);
                        try {
                            await api.delete(`/saved-transactions/${order.id}`);
                            setOrders(current => current.filter(item => item.id !== order.id));
                        } catch (requestError: any) {
                            Alert.alert('Gagal', requestError?.response?.data?.message || 'Order belum dapat dihapus.');
                        } finally {
                            setDeletingId(null);
                        }
                    },
                },
            ],
        );
    };

    const renderOrder = ({ item: order, index }: { item: TableOrder; index: number }) => {
        const { payload } = order;
        const total = Number(payload.grandTotal || payload.items.reduce(
            (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || item.qty || 1),
            0,
        ));

        return (
            <View style={tw`mx-4 mb-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden`}>
                <View style={tw`px-4 pt-4 pb-3 flex-row items-start justify-between`}>
                    <View style={tw`flex-1 pr-3`}>
                        <View style={tw`flex-row items-center flex-wrap mb-1`}>
                            <View style={tw`bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1 mr-2`}>
                                <Text style={tw`text-emerald-700 dark:text-emerald-300 text-xs font-black`}>
                                    {payload.tableNumber || 'Meja'}
                                </Text>
                            </View>
                            <Text style={tw`text-[11px] font-bold text-gray-400`}>{payload.orderCode || ''}</Text>
                        </View>
                        <Text style={tw`text-base font-black text-gray-900 dark:text-white`}>
                            {payload.customerName || 'Pelanggan'}
                        </Text>
                        <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-0.5`}>
                            {formatOrderTime(order.createdAt)}
                        </Text>
                        <Text style={tw`text-xs font-bold text-amber-600 dark:text-amber-300 mt-1`}>
                            Urutan {index + 1} dari {orders.length} menunggu
                        </Text>
                    </View>
                    <View style={tw`bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 items-center min-w-20`}>
                        <Text style={tw`text-[9px] font-black text-blue-500 dark:text-blue-300 uppercase`}>Antrean</Text>
                        <Text style={tw`text-lg font-black text-blue-700 dark:text-blue-200`}>
                            {payload.queueLabel || 'Lama'}
                        </Text>
                    </View>
                </View>

                <View style={tw`mx-4 border-t border-gray-100 dark:border-gray-700 pt-3`}>
                    {payload.items.map((product, index) => (
                        <View key={`${product.productId || product.id}-${index}`} style={tw`flex-row items-start mb-2`}>
                            <Text style={tw`w-8 text-sm font-black text-gray-700 dark:text-gray-200`}>
                                {Number(product.quantity || product.qty || 1)}x
                            </Text>
                            <View style={tw`flex-1`}>
                                <Text style={tw`text-sm font-bold text-gray-800 dark:text-gray-100`}>{product.name}</Text>
                                {product.notes ? (
                                    <Text style={tw`text-xs text-gray-500 dark:text-gray-400 mt-0.5`}>{product.notes}</Text>
                                ) : null}
                            </View>
                            <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 ml-3`}>
                                {formatRp(Number(product.price || 0) * Number(product.quantity || product.qty || 1))}
                            </Text>
                        </View>
                    ))}
                    {payload.note ? (
                        <View style={tw`bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 mt-1 mb-3 flex-row items-start`}>
                            <Icon name="note-text-outline" size={15} color={tw.color('gray-500')} style={tw`mr-2 mt-0.5`} />
                            <Text style={tw`flex-1 text-xs text-gray-600 dark:text-gray-300`}>{payload.note}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={tw`px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex-row items-center`}>
                    <View style={tw`flex-1`}>
                        <Text style={tw`text-[10px] font-bold text-gray-400 uppercase`}>Total</Text>
                        <Text style={tw`text-base font-black text-gray-900 dark:text-white`}>{formatRp(total)}</Text>
                    </View>
                    <TouchableOpacity
                        accessibilityLabel="Tolak order"
                        disabled={deletingId === order.id}
                        onPress={() => rejectOrder(order)}
                        style={tw`w-11 h-11 items-center justify-center border border-red-200 dark:border-red-900 rounded-lg mr-2`}
                    >
                        {deletingId === order.id ? (
                            <ActivityIndicator size="small" color={tw.color('red-500')} />
                        ) : (
                            <Icon name="delete-outline" size={20} color={tw.color('red-500')} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => processOrder(order)}
                        style={tw`h-11 bg-blue-600 rounded-lg px-4 flex-row items-center justify-center`}
                    >
                        <Icon name="point-of-sale" size={18} color="white" />
                        <Text style={tw`text-white font-black text-sm ml-2`}>Proses di Kasir</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={tw`flex-1 bg-gray-50 dark:bg-gray-950`}>
            <View style={tw`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex-row items-center`}>
                <TouchableOpacity
                    accessibilityLabel="Kembali"
                    onPress={() => navigation.goBack()}
                    style={tw`w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3`}
                >
                    <Icon name="arrow-left" size={21} color={tw.color('gray-700')} />
                </TouchableOpacity>
                <View style={tw`flex-1`}>
                    <Text style={tw`text-lg font-black text-gray-900 dark:text-white`}>Order Meja</Text>
                    <Text style={tw`text-xs text-gray-500 dark:text-gray-400`}>Pesanan QR pelanggan</Text>
                </View>
                <TouchableOpacity
                    accessibilityLabel="Muat ulang"
                    onPress={() => {
                        setRefreshing(true);
                        loadOrders();
                    }}
                    style={tw`w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 items-center justify-center`}
                >
                    <Icon name="refresh" size={20} color={tw.color('blue-600')} />
                </TouchableOpacity>
            </View>

            {settings.enableTableOrder ? (
                <>
                    <View style={tw`mx-4 my-4 bg-blue-600 rounded-xl px-4 py-3 flex-row items-center`}>
                        <View style={tw`flex-1`}>
                            <Text style={tw`text-blue-100 text-[10px] font-bold uppercase`}>Menunggu</Text>
                            <Text style={tw`text-white text-2xl font-black`}>{orders.length}</Text>
                        </View>
                        <View style={tw`w-px h-10 bg-blue-400 mx-4`} />
                        <View style={tw`flex-1`}>
                            <Text style={tw`text-blue-100 text-[10px] font-bold uppercase`}>Berikutnya</Text>
                            <Text style={tw`text-white text-2xl font-black`}>{orders[0]?.payload.queueLabel || '-'}</Text>
                        </View>
                        <Icon name="qrcode-scan" size={28} color="#BFDBFE" />
                    </View>

                    {loading ? (
                        <View style={tw`flex-1 items-center justify-center`}>
                            <ActivityIndicator size="large" color={tw.color('blue-600')} />
                        </View>
                    ) : (
                        <FlatList
                            data={orders}
                            keyExtractor={item => String(item.id)}
                            renderItem={renderOrder}
                            contentContainerStyle={orders.length === 0 ? tw`flex-grow` : tw`pb-8`}
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
                            ListEmptyComponent={(
                                <View style={tw`flex-1 items-center justify-center px-8 pb-20`}>
                                    <View style={tw`w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 items-center justify-center mb-4`}>
                                        <Icon name="table-chair" size={30} color={tw.color('emerald-600')} />
                                    </View>
                                    <Text style={tw`text-lg font-black text-gray-800 dark:text-gray-100 text-center`}>
                                        Belum ada order masuk
                                    </Text>
                                    {error ? (
                                        <Text style={tw`text-sm text-red-500 text-center mt-2`}>{error}</Text>
                                    ) : (
                                        <Text style={tw`text-sm text-gray-500 dark:text-gray-400 text-center mt-2`}>
                                            Daftar akan diperbarui otomatis.
                                        </Text>
                                    )}
                                </View>
                            )}
                        />
                    )}
                </>
            ) : (
                <View style={tw`flex-1 items-center justify-center px-8`}>
                    <Icon name="qrcode-off" size={42} color={tw.color('gray-400')} />
                    <Text style={tw`text-lg font-black text-gray-800 dark:text-gray-100 mt-4`}>Order meja tidak aktif</Text>
                </View>
            )}
        </View>
    );
}
