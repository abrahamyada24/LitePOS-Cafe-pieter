const DEFAULT_SHIFT_REMINDER_SETTINGS = Object.freeze({
    enableShiftReminder: true,
    shiftDurationMinutes: 480,
    shiftReminderMinutes: 15,
    shiftDayCutoff: '23:50',
});

const finiteInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};

const normalizeShiftReminderSettings = (setting = {}) => ({
    enableShiftReminder: setting.enableShiftReminder !== false,
    shiftDurationMinutes: Math.min(
        2880,
        Math.max(30, finiteInteger(setting.shiftDurationMinutes, DEFAULT_SHIFT_REMINDER_SETTINGS.shiftDurationMinutes))
    ),
    shiftReminderMinutes: Math.min(
        240,
        Math.max(0, finiteInteger(setting.shiftReminderMinutes, DEFAULT_SHIFT_REMINDER_SETTINGS.shiftReminderMinutes))
    ),
    shiftDayCutoff: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(setting.shiftDayCutoff || ''))
        ? String(setting.shiftDayCutoff)
        : DEFAULT_SHIFT_REMINDER_SETTINGS.shiftDayCutoff,
});

const calculateExpectedCloseAt = (openedAt, setting = {}) => {
    const normalized = normalizeShiftReminderSettings(setting);
    const opened = openedAt instanceof Date ? openedAt : new Date(openedAt);
    if (!Number.isFinite(opened.getTime())) throw new Error('Waktu pembukaan shift tidak valid.');
    return new Date(opened.getTime() + normalized.shiftDurationMinutes * 60 * 1000);
};

module.exports = {
    DEFAULT_SHIFT_REMINDER_SETTINGS,
    normalizeShiftReminderSettings,
    calculateExpectedCloseAt,
};
