const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const {
  LOGIN_LOCK_DURATION_MS,
  LOGIN_LOCK_THRESHOLD,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  validatePassword,
} = require('../config/auth');
const {
  createAuthSession,
  revokeAllUserSessions,
  revokeSession,
} = require('../services/authSessionService');

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('litepos-invalid-password-placeholder', PASSWORD_HASH_ROUNDS);

const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE_NAME, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  imageUrl: user.imageUrl,
  mustChangePassword: Boolean(user.mustChangePassword),
});

const genericLoginFailure = (res) => res.status(401).json({
  success: false,
  code: 'INVALID_CREDENTIALS',
  message: 'Email atau password salah.',
});

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = String(role || 'CASHIER').toUpperCase();
    const passwordError = validatePassword(password);

    if (!normalizedName || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi.' });
    }
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (!['ADMIN', 'CASHIER'].includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: 'Role user tidak valid.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Data pengguna tidak dapat dibuat.' });
    }

    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: await bcrypt.hash(String(password), PASSWORD_HASH_ROUNDS),
        role: normalizedRole,
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
        mustChangePassword: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'User berhasil dibuat dan wajib mengganti password saat login pertama.',
      data: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal membuat pengguna.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, clientType, deviceName } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedClientType = String(clientType || 'WEB').toUpperCase() === 'ANDROID' ? 'ANDROID' : 'WEB';

    if (!normalizedEmail || !password) return genericLoginFailure(res);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      await bcrypt.compare(String(password), DUMMY_PASSWORD_HASH);
      return genericLoginFailure(res);
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      return res.status(429).json({
        success: false,
        code: 'LOGIN_TEMPORARILY_LOCKED',
        message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.',
      });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password);
    if (!passwordMatches || !user.isActive) {
      const failedAttempts = Number(user.failedLoginAttempts || 0) + 1;
      const shouldLock = failedAttempts >= LOGIN_LOCK_THRESHOLD;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : failedAttempts,
          lockedUntil: shouldLock ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS) : null,
        },
      });
      return genericLoginFailure(res);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });

    const { session, token } = await createAuthSession({
      prisma,
      user,
      clientType: normalizedClientType,
      deviceName,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    return res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      sessionExpiresAt: session.expiresAt,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(`[LOGIN ERROR]: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Login belum dapat diproses.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Password lama dan password baru wajib diisi.' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan atau tidak aktif.' });
    }

    const currentPasswordMatches = await bcrypt.compare(String(oldPassword), user.password);
    if (!currentPasswordMatches) {
      return res.status(401).json({ success: false, message: 'Password lama salah.' });
    }
    if (await bcrypt.compare(String(newPassword), user.password)) {
      return res.status(400).json({ success: false, message: 'Password baru harus berbeda dari password lama.' });
    }

    const changedAt = new Date();
    const hashedPassword = await bcrypt.hash(String(newPassword), PASSWORD_HASH_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
          passwordChangedAt: changedAt,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: changedAt, revokeReason: 'PASSWORD_CHANGED' },
      }),
    ]);

    clearSessionCookie(res);
    return res.json({
      success: true,
      code: 'PASSWORD_CHANGED_RELOGIN_REQUIRED',
      message: 'Password berhasil diubah. Silakan login kembali.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Password belum dapat diubah.' });
  }
};

exports.logout = async (req, res) => {
  await revokeSession(prisma, req.authSession.id, 'LOGOUT');
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Logout berhasil.' });
};

exports.logoutAll = async (req, res) => {
  await revokeAllUserSessions(prisma, req.user.id, 'LOGOUT_ALL');
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Semua perangkat berhasil dikeluarkan.' });
};

exports.getSessions = async (req, res) => {
  const sessions = await prisma.authSession.findMany({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      clientType: true,
      deviceName: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
    orderBy: { lastSeenAt: 'desc' },
  });
  return res.json({ success: true, data: sessions });
};

exports.revokeSession = async (req, res) => {
  const result = await prisma.authSession.updateMany({
    where: { id: req.params.id, userId: req.user.id, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: 'USER_REVOKED' },
  });
  if (result.count === 0) {
    return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });
  }
  if (req.params.id === req.authSession.id) clearSessionCookie(res);
  return res.json({ success: true, message: 'Sesi berhasil dicabut.' });
};

exports.me = async (req, res) => res.json({
  success: true,
  user: {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    mustChangePassword: req.user.mustChangePassword,
  },
});
