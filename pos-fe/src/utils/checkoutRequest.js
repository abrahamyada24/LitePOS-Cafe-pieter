const PENDING_KEY = 'litepos-pending-checkout-v1';
const storageKey = (userId) => {
  let currentUserId = userId;
  if (currentUserId == null) {
    try { currentUserId = JSON.parse(localStorage.getItem('pos-storage') || '{}').state?.user?.id; } catch {}
  }
  return `${PENDING_KEY}:${currentUserId ?? 'anonymous'}`;
};
export const prepareCheckoutRequest = (payload) => {
  let deviceKey = localStorage.getItem('litepos-invoice-device');
  if (!deviceKey) {
    deviceKey = crypto.randomUUID();
    localStorage.setItem('litepos-invoice-device', deviceKey);
  }
  const body = { ...payload, deviceKey };
  const fingerprint = JSON.stringify(body);
  let pending;
  const key = storageKey(payload.userId);
  try { pending = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  if (pending && pending.fingerprint !== fingerprint) {
    throw new Error('Ada checkout sebelumnya yang belum terkonfirmasi. Periksa riwayat atau ulangi keranjang sebelumnya sebelum membuat transaksi lain.');
  }
  if (!pending) {
    pending = { fingerprint, body, key: crypto.randomUUID() };
    localStorage.setItem(key, JSON.stringify(pending));
  }
  return { body, key: pending.key };
};
export const finishCheckoutRequest = (userId) => localStorage.removeItem(storageKey(userId));

export const getPendingCheckout = (userId) => { try { return JSON.parse(localStorage.getItem(storageKey(userId)) || 'null'); } catch { return null; } };
