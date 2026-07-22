const crypto = require('crypto');
const { LICENSE_GENERATOR_PUBLIC_KEY_BASE64 } = require('../config/licenseGeneratorPublicKey');

const TOKEN_PATTERN = /^LP1-([A-F0-9]{36})-([A-F0-9]{128})$/;
const CLOCK_SKEW_SECONDS = 5 * 60;
const MAX_REDEMPTION_WINDOW_SECONDS = 90 * 24 * 60 * 60;

const PERIODS = new Map([
  [1, { label: '1 bulan', durationDays: 30 }],
  [2, { label: '3 bulan', durationDays: 90 }],
  [3, { label: '6 bulan', durationDays: 180 }],
  [4, { label: '1 tahun', durationDays: 365 }],
]);

const normalizeManualCode = (code) => String(code || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '');

const verifyManualLicenseCode = (code, now = new Date()) => {
  const normalized = normalizeManualCode(code);
  const match = normalized.match(TOKEN_PATTERN);
  if (!match) return null;

  const payload = Buffer.from(match[1], 'hex');
  const signature = Buffer.from(match[2], 'hex');
  if (payload.length !== 18 || signature.length !== 64 || payload.readUInt8(0) !== 1) {
    return null;
  }

  const period = PERIODS.get(payload.readUInt8(1));
  if (!period) return null;

  const issuedAtSeconds = payload.readUInt32BE(2);
  const validUntilSeconds = payload.readUInt32BE(6);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (
    issuedAtSeconds > nowSeconds + CLOCK_SKEW_SECONDS
    || validUntilSeconds <= nowSeconds
    || validUntilSeconds <= issuedAtSeconds
    || validUntilSeconds - issuedAtSeconds > MAX_REDEMPTION_WINDOW_SECONDS
  ) {
    return null;
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(LICENSE_GENERATOR_PUBLIC_KEY_BASE64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const valid = crypto.verify('sha256', payload, {
      key: publicKey,
      dsaEncoding: 'ieee-p1363',
    }, signature);
    if (!valid) return null;
  } catch (_error) {
    return null;
  }

  return {
    durationDays: period.durationDays,
    periodLabel: period.label,
    validUntil: new Date(validUntilSeconds * 1000),
  };
};

module.exports = {
  normalizeManualCode,
  verifyManualLicenseCode,
};
