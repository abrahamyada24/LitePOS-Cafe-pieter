import { getDBConnection } from '../database/db';

export interface ActiveShiftData {
    id: string;
    openingCash: number;
    openedAt: string;
}

export const openCashierShift = async (user: any, openingCash: number): Promise<ActiveShiftData> => {
    const db = await getDBConnection();
    const id = `SHIFT-${Date.now()}`;
    const openedAt = new Date().toISOString();

    await db.executeSql(
        `INSERT INTO shifts (id, userId, userName, openedAt, openingCash, status) VALUES (?, ?, ?, ?, ?, 'OPEN')`,
        [id, user?.id || 0, user?.name || 'Kasir', openedAt, openingCash]
    );

    return { id, openingCash, openedAt };
};
