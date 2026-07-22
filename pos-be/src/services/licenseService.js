const crypto = require('crypto');

const STORE_LICENSE_ID = 1;
const TRIAL_DURATION_DAYS = 14;
const LICENSE_CACHE_MS = 30 * 1000;
let cachedLicense = null;
let cacheExpiresAt = 0;

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const generateLicenseNumber = () => `LP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

const normalizeActivationCode = (code) => String(code || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

const getLicenseCodeSecret = () => {
  const secret = process.env.LICENSE_CODE_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'litepos-development-only-secret';
  throw new Error('LICENSE_CODE_SECRET atau JWT_SECRET wajib tersedia.');
};

const hashActivationCode = (code) => crypto
  .createHmac('sha256', getLicenseCodeSecret())
  .update(normalizeActivationCode(code))
  .digest('hex');

const invalidateLicenseCache = () => {
  cachedLicense = null;
  cacheExpiresAt = 0;
};

const ensureStoreLicense = async (prisma) => {
  const existing = await prisma.storeLicense.findUnique({ where: { id: STORE_LICENSE_ID } });
  if (existing) return existing;

  const now = new Date();
  try {
    return await prisma.storeLicense.create({
      data: {
        id: STORE_LICENSE_ID,
        licenseNumber: generateLicenseNumber(),
        plan: 'TRIAL',
        state: 'ACTIVE',
        startsAt: now,
        expiresAt: addDays(now, TRIAL_DURATION_DAYS),
        activationSource: 'AUTO_TRIAL',
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return prisma.storeLicense.findUnique({ where: { id: STORE_LICENSE_ID } });
    }
    throw error;
  }
};

const serializeLicense = (license, now = new Date()) => {
  const expired = Boolean(license.expiresAt && license.expiresAt <= now);
  const status = license.state === 'SUSPENDED' ? 'SUSPENDED' : expired ? 'EXPIRED' : 'ACTIVE';
  const daysRemaining = license.expiresAt
    ? Math.max(0, Math.ceil((license.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  return {
    licenseNumber: license.licenseNumber,
    plan: license.plan,
    status,
    isActive: status === 'ACTIVE',
    startsAt: license.startsAt,
    expiresAt: license.expiresAt,
    activatedAt: license.activatedAt,
    activationSource: license.activationSource,
    offlineGraceDays: license.offlineGraceDays,
    daysRemaining,
    serverTime: now,
  };
};

const getLicenseStatus = async (prisma, { useCache = true } = {}) => {
  const now = Date.now();
  if (useCache && cachedLicense && cacheExpiresAt > now) return cachedLicense;
  const license = await ensureStoreLicense(prisma);
  const payload = serializeLicense(license, new Date(now));
  cachedLicense = payload;
  cacheExpiresAt = now + LICENSE_CACHE_MS;
  return payload;
};

const activateLicense = async ({ prisma, code, userEmail }) => {
  const normalizedCode = normalizeActivationCode(code);
  if (normalizedCode.length < 16) {
    const error = new Error('Format kode aktivasi tidak valid.');
    error.code = 'INVALID_LICENSE_CODE';
    throw error;
  }

  const now = new Date();
  const codeHash = hashActivationCode(normalizedCode);
  const result = await prisma.$transaction(async (tx) => {
    const activation = await tx.licenseActivation.findUnique({ where: { codeHash } });
    if (!activation || activation.redeemedAt || (activation.validUntil && activation.validUntil <= now)) {
      const error = new Error('Kode aktivasi tidak valid, sudah dipakai, atau kedaluwarsa.');
      error.code = 'INVALID_LICENSE_CODE';
      throw error;
    }

    const current = await ensureStoreLicense(tx);
    const baseDate = current.expiresAt && current.expiresAt > now ? current.expiresAt : now;
    const expiresAt = addDays(baseDate, activation.durationDays);
    const license = await tx.storeLicense.update({
      where: { id: STORE_LICENSE_ID },
      data: {
        plan: activation.plan,
        state: 'ACTIVE',
        expiresAt,
        activatedAt: now,
        activationSource: 'ACTIVATION_CODE',
      },
    });

    await tx.licenseActivation.update({
      where: { id: activation.id },
      data: {
        redeemedAt: now,
        redeemedByEmail: userEmail,
        licenseId: license.id,
      },
    });
    return license;
  });

  invalidateLicenseCache();
  return serializeLicense(result);
};

module.exports = {
  activateLicense,
  addDays,
  ensureStoreLicense,
  getLicenseStatus,
  hashActivationCode,
  invalidateLicenseCache,
  normalizeActivationCode,
  serializeLicense,
};
