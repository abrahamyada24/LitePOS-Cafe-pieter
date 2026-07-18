import { getDBConnection } from '../database/db';
import api from './api';

export interface ActiveShiftData {
    id: string;
    openingCash: number;
    openedAt: string;
}

const toActiveShift = (shift: any): ActiveShiftData => ({
    id: String(shift.id),
    openingCash: Number(shift.openingCash || 0),
    openedAt: shift.openedAt || new Date().toISOString(),
});

const saveServerShift = async (shift: any) => {
    const db = await getDBConnection();
    await db.executeSql(
        `INSERT OR REPLACE INTO shifts
         (id, userId, userName, openedAt, closedAt, openingCash, closingCash, status, isSynced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
            String(shift.id),
            Number(shift.userId || 0),
            shift.userName || 'Kasir',
            shift.openedAt || new Date().toISOString(),
            shift.closedAt || null,
            Number(shift.openingCash || 0),
            shift.closingCash == null ? null : Number(shift.closingCash),
            shift.status || 'OPEN',
        ]
    );
};

export const openCashierShift = async (user: any, openingCash: number): Promise<ActiveShiftData> => {
    try {
        const response = await api.post('/shifts/open', { openingCash });
        const serverShift = response.data?.data;
        if (!serverShift) throw new Error('Server tidak mengembalikan data shift.');
        await saveServerShift(serverShift);
        return toActiveShift(serverShift);
    } catch (error: any) {
        const existingServerShift = error.response?.status === 409 ? error.response?.data?.data : null;
        if (existingServerShift) {
            await saveServerShift(existingServerShift);
            return toActiveShift(existingServerShift);
        }

        // Hanya buat shift lokal ketika server benar-benar tidak dapat dijangkau.
        // Respons HTTP dari server tetap dilempar agar konflik/validasi tidak disamarkan.
        if (error.response) throw error;

        const db = await getDBConnection();
        const [existingResult] = await db.executeSql(
            `SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY openedAt DESC LIMIT 1`
        );
        if (existingResult.rows.length > 0) {
            return toActiveShift(existingResult.rows.item(0));
        }

        const id = `SHIFT-${Date.now()}`;
        const openedAt = new Date().toISOString();
        await db.executeSql(
            `INSERT INTO shifts (id, userId, userName, openedAt, openingCash, status, isSynced)
             VALUES (?, ?, ?, ?, ?, 'OPEN', 0)`,
            [id, user?.id || 0, user?.name || 'Kasir', openedAt, openingCash]
        );
        return { id, openingCash, openedAt };
    }
};

export const closeCashierShift = async (shift: ActiveShiftData, closingCash: number) => {
    const db = await getDBConnection();
    try {
        const response = await api.post(`/shifts/${encodeURIComponent(shift.id)}/close`, { closingCash });
        const serverShift = response.data?.data;
        if (!serverShift) throw new Error('Server tidak mengembalikan data penutupan shift.');
        await saveServerShift(serverShift);
        return serverShift;
    } catch (error: any) {
        const status = error.response?.status;
        const closedAt = new Date().toISOString();

        if (status === 400 && /sudah ditutup/i.test(error.response?.data?.message || '')) {
            await db.executeSql(
                `UPDATE shifts SET status = 'CLOSED', closedAt = COALESCE(closedAt, ?),
                 closingCash = COALESCE(closingCash, ?), isSynced = 1 WHERE id = ?`,
                [closedAt, closingCash, shift.id]
            );
            return { ...shift, status: 'CLOSED', closedAt, closingCash };
        }

        if (!error.response || status === 404) {
            await db.executeSql(
                `UPDATE shifts SET status = 'CLOSED', closedAt = ?, closingCash = ?, isSynced = 0 WHERE id = ?`,
                [closedAt, closingCash, shift.id]
            );
            return { ...shift, status: 'CLOSED', closedAt, closingCash };
        }

        throw error;
    }
};
