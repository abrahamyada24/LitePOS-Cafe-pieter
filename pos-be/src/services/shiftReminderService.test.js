const test = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateExpectedCloseAt,
    normalizeShiftReminderSettings,
} = require('./shiftReminderService');

test('menghitung target tutup dari waktu buka dan durasi shift', () => {
    const openedAt = new Date('2026-07-31T01:00:00.000Z');
    const expected = calculateExpectedCloseAt(openedAt, { shiftDurationMinutes: 480 });
    assert.equal(expected.toISOString(), '2026-07-31T09:00:00.000Z');
});

test('menormalkan konfigurasi reminder yang tidak valid', () => {
    const settings = normalizeShiftReminderSettings({
        shiftDurationMinutes: -1,
        shiftReminderMinutes: 999,
        shiftDayCutoff: '29:90',
    });
    assert.equal(settings.shiftDurationMinutes, 30);
    assert.equal(settings.shiftReminderMinutes, 240);
    assert.equal(settings.shiftDayCutoff, '23:50');
});
