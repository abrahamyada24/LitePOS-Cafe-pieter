const normalizeTime = (value?: string | null, fallback = '') => {
    const normalized = String(value || '').slice(0, 5);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : fallback;
};

export const getProductAvailability = (product: any, now = new Date()) => {
    const manuallyActive = product?.isActive === undefined
        || product?.isActive === null
        || product?.isActive === true
        || Number(product?.isActive) === 1;
    const scheduleEnabled = product?.availabilityScheduleEnabled === true
        || Number(product?.availabilityScheduleEnabled) === 1;

    if (!manuallyActive) {
        return { isAvailable: false, reason: 'INACTIVE' as const, label: 'Nonaktif' };
    }
    if (!scheduleEnabled) {
        return { isAvailable: true, reason: 'ALWAYS' as const, label: 'Aktif' };
    }

    const selectedDays = String(product?.availabilityDays || '')
        .split(',')
        .map(Number)
        .filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const startTime = normalizeTime(product?.availabilityStartTime, '00:00');
    const endTime = normalizeTime(product?.availabilityEndTime, '23:59');
    const crossesMidnight = startTime > endTime;
    const scheduleDay = crossesMidnight && currentTime <= endTime
        ? (now.getDay() + 6) % 7
        : now.getDay();

    if (selectedDays.length > 0 && !selectedDays.includes(scheduleDay)) {
        return { isAvailable: false, reason: 'OUTSIDE_DAY' as const, label: 'Di luar jadwal' };
    }

    const withinTime = crossesMidnight
        ? currentTime >= startTime || currentTime <= endTime
        : currentTime >= startTime && currentTime <= endTime;

    return withinTime
        ? { isAvailable: true, reason: 'SCHEDULED' as const, label: 'Aktif terjadwal' }
        : { isAvailable: false, reason: 'OUTSIDE_TIME' as const, label: 'Di luar jadwal' };
};

export const isProductAvailable = (product: any, now = new Date()) =>
    getProductAvailability(product, now).isAvailable;
