const normalizeAddonIds = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0))];
};

const normalizeAddonSelections = (value, productName = 'produk') => {
  if (!Array.isArray(value)) return [];

  const quantities = new Map();
  for (const rawSelection of value) {
    const isObjectSelection = rawSelection && typeof rawSelection === 'object' && !Array.isArray(rawSelection);
    const id = Number(isObjectSelection ? rawSelection.id : rawSelection);
    const quantity = Number(isObjectSelection ? (rawSelection.quantity ?? rawSelection.qty ?? 1) : 1);

    if (!Number.isInteger(id) || id <= 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
      throw new Error(`Jumlah add-on untuk ${productName} harus antara 1 sampai 99.`);
    }

    const nextQuantity = (quantities.get(id) || 0) + quantity;
    if (nextQuantity > 99) {
      throw new Error(`Jumlah add-on untuk ${productName} harus antara 1 sampai 99.`);
    }
    quantities.set(id, nextQuantity);
  }

  return [...quantities.entries()].map(([id, quantity]) => ({ id, quantity }));
};

const resolveSelectedAddons = (availableAddons, rawSelections, productName = 'produk') => {
  const requestedSelections = normalizeAddonSelections(rawSelections, productName);
  if (requestedSelections.length === 0) return [];

  const available = Array.isArray(availableAddons) ? availableAddons : [];
  const selected = requestedSelections.map(({ id, quantity }) => {
    const addon = available.find(item => Number(item.id) === id);
    return addon ? { ...addon, quantity } : null;
  }).filter(Boolean);
  if (selected.length !== requestedSelections.length) {
    throw new Error(`Pilihan add-on untuk ${productName} tidak valid.`);
  }
  return selected;
};

const buildAddonItemNotes = (selectedAddons, customerNotes) => {
  const addonLabel = selectedAddons.length > 0
    ? `Add-on: ${selectedAddons.map(addon => `${addon.name}${Number(addon.quantity || 1) > 1 ? ` x${Number(addon.quantity)}` : ''}`).join(', ')}`
    : '';
  const normalizedNotes = String(customerNotes || '').trim();
  return [addonLabel, normalizedNotes].filter(Boolean).join(' | ') || null;
};

const calculateAddonAwareLinePricing = (priceInfo, selectedAddons, productQuantity) => {
  const quantity = Math.max(1, Number(productQuantity) || 1);
  const basePrice = Math.max(0, Number(priceInfo?.effectivePrice || 0));
  const baseOriginalPrice = Math.max(basePrice, Number(priceInfo?.originalPrice ?? basePrice));
  const addonTotal = (Array.isArray(selectedAddons) ? selectedAddons : []).reduce(
    (total, addon) => total + (Math.max(0, Number(addon.price || 0)) * Math.max(1, Number(addon.quantity || 1))),
    0
  );
  const lineTotal = (basePrice * quantity) + addonTotal;
  const originalLineTotal = (baseOriginalPrice * quantity) + addonTotal;
  return { addonTotal, lineTotal, originalLineTotal, price: lineTotal / quantity, originalPrice: originalLineTotal / quantity };
};

module.exports = {
  normalizeAddonIds,
  normalizeAddonSelections,
  resolveSelectedAddons,
  buildAddonItemNotes,
  calculateAddonAwareLinePricing,
};
