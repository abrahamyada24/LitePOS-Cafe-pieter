export const getProductPrice = (product: any, now = new Date()) => {
    const originalPrice = Math.max(0, Number(product?.price) || 0);
    const discountValue = Math.max(0, Number(product?.discountValue) || 0);
    const discountType = String(product?.discountType || '').toUpperCase();
    let isDiscountActive = Number(product?.discountActive) === 1 && discountValue > 0;

    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateKey = (value?: string | null) => value ? String(value).slice(0, 10) : null;

    if (isDiscountActive && product.discountStartAt) isDiscountActive = currentDate >= String(dateKey(product.discountStartAt));
    if (isDiscountActive && product.discountEndAt) isDiscountActive = currentDate <= String(dateKey(product.discountEndAt));

    if (isDiscountActive && product.discountDays) {
        const days = String(product.discountDays).split(',').map(Number).filter(Number.isInteger);
        if (days.length > 0) isDiscountActive = days.includes(now.getDay());
    }

    if (isDiscountActive && (product.discountStartTime || product.discountEndTime)) {
        const start = product.discountStartTime || '00:00';
        const end = product.discountEndTime || '23:59';
        isDiscountActive = start <= end
            ? currentTime >= start && currentTime <= end
            : currentTime >= start || currentTime <= end;
    }

    let discountAmount = 0;
    if (isDiscountActive) {
        discountAmount = discountType === 'PERCENT'
            ? originalPrice * Math.min(100, discountValue) / 100
            : discountValue;
        discountAmount = Math.min(originalPrice, Math.max(0, Math.round(discountAmount)));
    }

    return {
        originalPrice,
        effectivePrice: originalPrice - discountAmount,
        discountAmount,
        isDiscountActive,
        discountLabel: product?.discountLabel || null
    };
};

export const applyProductDiscount = (product: any) => {
    const priceInfo = getProductPrice(product);
    return { ...product, ...priceInfo, price: priceInfo.effectivePrice };
};
