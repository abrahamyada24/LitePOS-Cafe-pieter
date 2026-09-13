const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const isEnabled = value => value === true || value === 1 || value === '1' || value === 'true';

const getJakartaClock = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: JAKARTA_TIME_ZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { day: DAY_INDEX[values.weekday], time: `${values.hour}:${values.minute}` };
};

const isProductAvailable = (product, now = new Date()) => {
    if (!product || !isEnabled(product.isActive)) return false;
    if (!isEnabled(product.availabilityScheduleEnabled)) return true;

    const selectedDays = String(product.availabilityDays || '')
        .split(',')
        .map(Number)
        .filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
    const startTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(product.availabilityStartTime || ''))
        ? product.availabilityStartTime
        : '00:00';
    const endTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(product.availabilityEndTime || ''))
        ? product.availabilityEndTime
        : '23:59';
    const current = getJakartaClock(now);
    const crossesMidnight = startTime > endTime;
    const scheduleDay = crossesMidnight && current.time <= endTime
        ? (current.day + 6) % 7
        : current.day;

    if (selectedDays.length > 0 && !selectedDays.includes(scheduleDay)) return false;
    return crossesMidnight
        ? current.time >= startTime || current.time <= endTime
        : current.time >= startTime && current.time <= endTime;
};

module.exports = { getJakartaClock, isProductAvailable };
