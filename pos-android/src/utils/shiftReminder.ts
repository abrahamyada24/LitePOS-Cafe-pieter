export const DEFAULT_SHIFT_REMINDER_SETTINGS = {
    enableShiftReminder: true,
    shiftDurationMinutes: 480,
    shiftReminderMinutes: 15,
    shiftDayCutoff: '23:50',
};

export interface ShiftReminderSettings {
    enableShiftReminder?: boolean;
    shiftDurationMinutes?: number | string;
    shiftReminderMinutes?: number | string;
    shiftDayCutoff?: string;
}

export interface ReminderShift {
    id: string;
    openedAt: string;
    expectedCloseAt?: string | null;
    userName?: string;
}

export interface ShiftReminderState {
    phase: 'UPCOMING' | 'OVERDUE' | 'DAY_CUTOFF';
    title: string;
    message: string;
    expectedCloseAt: Date | null;
}

const STORE_TIME_ZONE = 'Asia/Jakarta';
const STORE_UTC_OFFSET = '+07:00';

const finiteNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeShiftReminderSettings = (settings: ShiftReminderSettings = {}) => ({
    enableShiftReminder: settings.enableShiftReminder !== false,
    shiftDurationMinutes: Math.min(
        2880,
        Math.max(30, Math.round(finiteNumber(settings.shiftDurationMinutes, 480)))
    ),
    shiftReminderMinutes: Math.min(
        240,
        Math.max(0, Math.round(finiteNumber(settings.shiftReminderMinutes, 15)))
    ),
    shiftDayCutoff: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(settings.shiftDayCutoff || ''))
        ? String(settings.shiftDayCutoff)
        : '23:50',
});

export const getOpeningExpectedCloseAt = (
    settings: ShiftReminderSettings = {},
    openedAt: Date = new Date()
) => {
    const normalized = normalizeShiftReminderSettings(settings);
    return new Date(openedAt.getTime() + normalized.shiftDurationMinutes * 60 * 1000);
};

export const getShiftExpectedCloseAt = (
    shift: ReminderShift,
    settings: ShiftReminderSettings = {}
) => {
    const stored = shift.expectedCloseAt ? new Date(shift.expectedCloseAt) : null;
    if (stored && Number.isFinite(stored.getTime())) return stored;
    const openedAt = new Date(shift.openedAt);
    if (!Number.isFinite(openedAt.getTime())) return null;
    return getOpeningExpectedCloseAt(settings, openedAt);
};

const getStoreDateParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: STORE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    return Object.fromEntries(parts.map(part => [part.type, part.value])) as Record<string, string>;
};

const getDayCutoffAt = (shift: ReminderShift, settings: ReturnType<typeof normalizeShiftReminderSettings>) => {
    const openedAt = new Date(shift.openedAt);
    if (!Number.isFinite(openedAt.getTime())) return null;
    const parts = getStoreDateParts(openedAt);
    const cutoff = new Date(`${parts.year}-${parts.month}-${parts.day}T${settings.shiftDayCutoff}:00${STORE_UTC_OFFSET}`);
    if (openedAt.getTime() >= cutoff.getTime()) cutoff.setTime(cutoff.getTime() + 24 * 60 * 60 * 1000);
    return cutoff;
};

export const formatShiftDateTime = (value: Date | string) => new Intl.DateTimeFormat('id-ID', {
    timeZone: STORE_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
}).format(new Date(value));

export const getShiftReminder = (
    shift: ReminderShift | null,
    rawSettings: ShiftReminderSettings = {},
    now: Date = new Date()
): ShiftReminderState | null => {
    if (!shift?.id || !shift.openedAt) return null;
    const settings = normalizeShiftReminderSettings(rawSettings);
    if (!settings.enableShiftReminder) return null;

    const nowMs = now.getTime();
    const expectedCloseAt = getShiftExpectedCloseAt(shift, settings);
    const cutoffAt = getDayCutoffAt(shift, settings);
    const openedLabel = formatShiftDateTime(shift.openedAt);
    const expectedLabel = expectedCloseAt ? formatShiftDateTime(expectedCloseAt) : null;

    if (cutoffAt && nowMs >= cutoffAt.getTime()) {
        return {
            phase: 'DAY_CUTOFF',
            title: 'Hari operasional segera berganti',
            message: `Shift ${shift.userName || 'kasir'} yang dibuka ${openedLabel} masih aktif. Lakukan closing agar transaksi tidak masuk ke shift hari berikutnya.`,
            expectedCloseAt,
        };
    }
    if (expectedCloseAt && nowMs >= expectedCloseAt.getTime()) {
        return {
            phase: 'OVERDUE',
            title: 'Waktunya closing shift',
            message: `Target tutup ${expectedLabel} sudah lewat. Segera hitung kas akhir dan tutup shift.`,
            expectedCloseAt,
        };
    }
    const reminderAt = expectedCloseAt
        ? expectedCloseAt.getTime() - settings.shiftReminderMinutes * 60 * 1000
        : null;
    if (reminderAt !== null && nowMs >= reminderAt) {
        return {
            phase: 'UPCOMING',
            title: 'Shift segera berakhir',
            message: `Shift dijadwalkan tutup ${expectedLabel}. Siapkan perhitungan kas akhir.`,
            expectedCloseAt,
        };
    }
    return null;
};
