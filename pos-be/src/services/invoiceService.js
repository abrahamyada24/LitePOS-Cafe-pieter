const { createHash } = require('node:crypto');

const jakartaDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date).replace(/-/g, '');

const registerTerminal = async (db, deviceKey, kind = 'WEB') => {
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(deviceKey || ''))) {
    throw new Error('Identitas perangkat tidak valid. Muat ulang aplikasi.');
  }
  const terminal = await db.invoiceTerminal.upsert({
    where: { deviceKey }, create: { deviceKey, kind }, update: {},
  });
  return { ...terminal, code: `${terminal.kind === 'ANDROID' ? 'K' : 'W'}${String(terminal.id).padStart(2, '0')}` };
};

const reserveInvoice = async (db, deviceKey) => {
  const terminal = await registerTerminal(db, deviceKey);
  const day = jakartaDay();
  const key = `${terminal.code}/${day}`;
  const counter = await db.invoiceCounter.upsert({
    where: { key }, create: { key, lastNumber: 1 }, update: { lastNumber: { increment: 1 } },
  });
  return `INV/${day}/${terminal.code}/${String(counter.lastNumber).padStart(4, '0')}`;
};

const checkoutIdentity = (req) => {
  const key = req.get('Idempotency-Key') || req.body.idempotencyKey;
  if (!key) return { key: null, fingerprint: null };
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(key || ''))) throw new Error('Identitas checkout tidak valid. Muat ulang kasir.');
  const { idempotencyKey, ...body } = req.body;
  return { key: `web:${key}`, fingerprint: createHash('sha256').update(JSON.stringify({ userId: req.user.id, body })).digest('hex') };
};

module.exports = { jakartaDay, registerTerminal, reserveInvoice, checkoutIdentity };
