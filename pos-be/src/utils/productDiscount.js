const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

const getJakartaParts = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: JAKARTA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
};

const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const toJakartaDateKey = (date) => {
    if (!date) return null;
    const parts = getJakartaParts(new Date(date));
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const isTimeInWindow = (currentTime, startTime, endTime) => {
    if (!startTime && !endTime) return true;
    if (startTime && !endTime) return currentTime >= startTime;
    if (!startTime && endTime) return currentTime <= endTime;
    if (startTime <= endTime) return currentTime >= startTime && currentTime <= endTime;
    return currentTime >= startTime || currentTime <= endTime;
};

const getProductPrice = (product, now = new Date()) => {
    const originalPrice = Math.max(0, Number(product.price) || 0);
    const discountValue = Math.max(0, Number(product.discountValue) || 0);
    const discountType = String(product.discountType || '').toUpperCase();
    let isDiscountActive = Boolean(product.discountActive) && discountValue > 0;

    const current = getJakartaParts(now);
    const currentDate = `${current.year}-${current.month}-${current.day}`;
    const currentTime = `${current.hour}:${current.minute}`;

    if (isDiscountActive && product.discountStartAt) {
        isDiscountActive = currentDate >= toJakartaDateKey(product.discountStartAt);
    }
    if (isDiscountActive && product.discountEndAt) {
        isDiscountActive = currentDate <= toJakartaDateKey(product.discountEndAt);
    }

    if (isDiscountActive && product.discountDays) {
        const activeDays = String(product.discountDays)
            .split(',')
            .map(value => Number(value.trim()))
            .filter(value => Number.isInteger(value));
        if (activeDays.length > 0) {
            isDiscountActive = activeDays.includes(DAY_INDEX[current.weekday]);
        }
    }

    if (isDiscountActive) {
        isDiscountActive = isTimeInWindow(
            currentTime,
            product.discountStartTime || null,
            product.discountEndTime || null
        );
    }

    let discountAmount = 0;
    if (isDiscountActive) {
        discountAmount = discountType === 'PERCENT'
            ? originalPrice * Math.min(discountValue, 100) / 100
            : discountValue;
        discountAmount = Math.min(originalPrice, Math.max(0, Math.round(discountAmount)));
    }

    return {
        originalPrice,
        effectivePrice: originalPrice - discountAmount,
        discountAmount,
        isDiscountActive,
        discountLabel: product.discountLabel || null,
        discountType: discountType || null,
        discountValue
    };
};

const serializeProductPrice = (product, now = new Date()) => ({
    ...product,
    ...getProductPrice(product, now)
});

module.exports = { getProductPrice, serializeProductPrice, getJakartaParts };
