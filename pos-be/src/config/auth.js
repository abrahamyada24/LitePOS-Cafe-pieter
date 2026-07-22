const SESSION_COOKIE_NAME = 'litepos_session';
const SESSION_ABSOLUTE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;
const JWT_ISSUER = 'litepos-api';
const JWT_AUDIENCE = 'litepos-clients';

const BLOCKED_PASSWORDS = new Set([
  'boss123',
  'admin123',
  'cashier123',
  'password',
  'password123',
  '123456',
  '12345678',
  'qwerty123',
]);

const getSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: SESSION_ABSOLUTE_TIMEOUT_MS,
  path: '/',
});

const validatePassword = (password) => {
  const value = String(password || '');
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) {
    return `Password maksimal ${PASSWORD_MAX_BYTES} byte.`;
  }
  if (BLOCKED_PASSWORDS.has(value.toLowerCase())) {
    return 'Password terlalu umum. Gunakan password lain.';
  }
  return null;
};

module.exports = {
  JWT_AUDIENCE,
  JWT_ISSUER,
  LOGIN_LOCK_DURATION_MS,
  LOGIN_LOCK_THRESHOLD,
  PASSWORD_MIN_LENGTH,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
  getSessionCookieOptions,
  validatePassword,
};
