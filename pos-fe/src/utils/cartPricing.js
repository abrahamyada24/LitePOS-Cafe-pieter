const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getCartItemQuantity = (item) => Math.max(1, toNumber(item?.qty ?? item?.quantity, 1));
export const getCartItemAddonTotal = (item) => (
  Array.isArray(item?.addons)
    ? item.addons.reduce(
        (total, addon) => total + (toNumber(addon?.price) * Math.max(1, toNumber(addon?.quantity, 1))),
        0
      )
    : 0
);
export const getCartItemBaseUnitPrice = (item) => toNumber(item?.basePrice ?? item?.price);
export const getCartItemLineTotal = (item) => (
  Array.isArray(item?.addons)
    ? (getCartItemBaseUnitPrice(item) * getCartItemQuantity(item)) + getCartItemAddonTotal(item)
    : toNumber(item?.price) * getCartItemQuantity(item)
);
export const getCartItemEffectiveUnitPrice = (item) => getCartItemLineTotal(item) / getCartItemQuantity(item);
