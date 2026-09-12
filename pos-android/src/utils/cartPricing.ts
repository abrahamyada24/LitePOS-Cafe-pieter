type AddonPricing = {
    price?: number;
    quantity?: number;
};

export type CartPricingItem = {
    price?: number;
    originalPrice?: number;
    basePrice?: number;
    baseOriginalPrice?: number;
    quantity?: number;
    addons?: AddonPricing[];
};

const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const getCartItemQuantity = (item: CartPricingItem) => (
    Math.max(1, toNumber(item.quantity, 1))
);

export const getCartItemAddonTotal = (item: CartPricingItem) => (
    Array.isArray(item.addons)
        ? item.addons.reduce(
            (total, addon) => total + (toNumber(addon.price) * Math.max(1, toNumber(addon.quantity, 1))),
            0,
        )
        : 0
);

export const getCartItemBaseUnitPrice = (item: CartPricingItem) => (
    toNumber(item.basePrice ?? item.price)
);

export const getCartItemLineTotal = (item: CartPricingItem) => (
    Array.isArray(item.addons)
        ? (getCartItemBaseUnitPrice(item) * getCartItemQuantity(item)) + getCartItemAddonTotal(item)
        : toNumber(item.price) * getCartItemQuantity(item)
);

export const getCartItemEffectiveUnitPrice = (item: CartPricingItem) => (
    getCartItemLineTotal(item) / getCartItemQuantity(item)
);

export const getCartItemOriginalLineTotal = (item: CartPricingItem) => {
    if (!Array.isArray(item.addons)) {
        return toNumber(item.originalPrice ?? item.price) * getCartItemQuantity(item);
    }
    const basePrice = getCartItemBaseUnitPrice(item);
    const baseOriginalPrice = toNumber(item.baseOriginalPrice ?? item.originalPrice, basePrice);
    return (baseOriginalPrice * getCartItemQuantity(item)) + getCartItemAddonTotal(item);
};

export const getCartItemEffectiveOriginalUnitPrice = (item: CartPricingItem) => (
    getCartItemOriginalLineTotal(item) / getCartItemQuantity(item)
);
