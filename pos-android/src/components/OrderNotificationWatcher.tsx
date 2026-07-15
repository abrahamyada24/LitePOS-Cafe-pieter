import React, { useEffect, useRef } from 'react';
import { NativeModules, Vibration } from 'react-native';
import api from '../services/api';
import { useStore } from '../store/useStore';

export default function OrderNotificationWatcher() {
    const user = useStore(state => state.user);
    const enableTableOrder = useStore(state => state.settings.enableTableOrder);
    const setTableOrderNotificationCount = useStore(state => state.setTableOrderNotificationCount);
    const previousCountRef = useRef<number | null>(null);

    useEffect(() => {
        if (!user || !enableTableOrder) {
            previousCountRef.current = null;
            setTableOrderNotificationCount(0);
            return undefined;
        }

        const refresh = async () => {
            try {
                const response = await api.get('/saved-transactions');
                const rows = Array.isArray(response.data?.data) ? response.data.data : [];
                const count = rows.filter((row: any) => {
                    try {
                        const payload = typeof row.cartData === 'string' ? JSON.parse(row.cartData) : row.cartData;
                        return payload?.source === 'TABLE_QR' || Boolean(payload?.tableNumber);
                    } catch {
                        return false;
                    }
                }).length;

                if (previousCountRef.current !== null && count > previousCountRef.current) {
                    NativeModules.OrderNotificationSound?.play();
                    Vibration.vibrate(180);
                }

                previousCountRef.current = count;
                setTableOrderNotificationCount(count);
            } catch {
                // Pertahankan badge terakhir saat koneksi sementara terputus.
            }
        };

        refresh();
        const intervalId = setInterval(refresh, 5000);
        return () => clearInterval(intervalId);
    }, [enableTableOrder, setTableOrderNotificationCount, user]);

    return null;
}
