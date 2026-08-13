const normalizeAddonIds = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0))];
};

const resolveSelectedAddons = (availableAddons, rawAddonIds, productName = 'produk') => {
  const requestedIds = normalizeAddonIds(rawAddonIds);
  if (requestedIds.length === 0) return [];

  const available = Array.isArray(availableAddons) ? availableAddons : [];
  const selected = requestedIds.map(id => available.find(addon => Number(addon.id) === id)).filter(Boolean);
  if (selected.length !== requestedIds.length) {
    throw new Error(`Pilihan add-on untuk ${productName} tidak valid.`);
  }
  return selected;
};

const buildAddonItemNotes = (selectedAddons, customerNotes) => {
  const addonLabel = selectedAddons.length > 0
    ? `Add-on: ${selectedAddons.map(addon => addon.name).join(', ')}`
    : '';
  const normalizedNotes = String(customerNotes || '').trim();
  return [addonLabel, normalizedNotes].filter(Boolean).join(' | ') || null;
};

module.exports = { normalizeAddonIds, resolveSelectedAddons, buildAddonItemNotes };
