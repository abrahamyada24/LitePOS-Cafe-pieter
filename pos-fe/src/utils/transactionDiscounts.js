const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getItemQuantity = (item) => Math.max(0, toNumber(item?.qty ?? item?.quantity));

export const getItemOriginalPrice = (item) => {
  const price = toNumber(item?.price);
  const originalPrice = toNumber(item?.originalPrice);
  return originalPrice > price ? originalPrice : price;
};

export const getItemUnitDiscount = (item) => {
  const storedDiscount = Math.max(0, toNumber(item?.discountAmount));
  const calculatedDiscount = Math.max(0, getItemOriginalPrice(item) - toNumber(item?.price));
  return storedDiscount > 0 ? storedDiscount : calculatedDiscount;
};

export const getItemProductDiscountTotal = (item) => (
  getItemUnitDiscount(item) * getItemQuantity(item)
);

export const getProductDiscountTotal = (items = []) => (
  items.reduce((total, item) => total + getItemProductDiscountTotal(item), 0)
);

export const hasProductDiscount = (item) => getItemUnitDiscount(item) > 0;
