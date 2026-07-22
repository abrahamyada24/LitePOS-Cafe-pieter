const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const {
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
} = require('../config/auth');

const prisma = new PrismaClient();

const getBearerToken = (authorization) => {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

const isPasswordChangeRoute = (req) => [
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/logout-all',
  '/api/auth/me',
].some((path) => req.originalUrl.startsWith(path));

exports.verifyToken = async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization) || req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      message: 'Sesi tidak ditemukan. Silakan login kembali.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
    });
    const userId = Number(decoded.sub);

    if (!decoded.sid || !decoded.jti || !Number.isInteger(userId)) {
      throw new Error('Token tidak memiliki identitas sesi.');
    }

    const session = await prisma.authSession.findUnique({
      where: { id: decoded.sid },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            imageUrl: true,
            isActive: true,
            mustChangePassword: true,
            passwordChangedAt: true,
          },
        },
      },
    });

    const now = new Date();
    const idleDeadline = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS);
    const sessionInvalid = !session
      || session.jwtId !== decoded.jti
      || session.userId !== userId
      || session.revokedAt
      || session.expiresAt <= now
      || !session.user?.isActive;

    if (sessionInvalid) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_INVALID',
        message: 'Sesi sudah tidak aktif. Silakan login kembali.',
      });
    }

    if (session.lastSeenAt < idleDeadline) {
      await prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'IDLE_TIMEOUT' },
      });
      return res.status(401).json({
        success: false,
        code: 'SESSION_IDLE_TIMEOUT',
        message: 'Sesi berakhir karena tidak aktif selama 30 menit.',
      });
    }

    if (session.user.passwordChangedAt && session.createdAt < session.user.passwordChangedAt) {
      await prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'PASSWORD_CHANGED' },
      });
      return res.status(401).json({
        success: false,
        code: 'SESSION_PASSWORD_CHANGED',
        message: 'Password telah berubah. Silakan login kembali.',
      });
    }

    if (session.user.mustChangePassword && !isPasswordChangeRoute(req)) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password wajib diganti sebelum melanjutkan.',
      });
    }

    if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }

    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
    };
    req.authSession = { id: session.id, clientType: session.clientType };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_INVALID',
      message: 'Sesi tidak valid atau sudah kedaluwarsa.',
    });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak! Hanya Admin/Owner yang boleh melakukan ini.',
    });
  }
  return next();
};

exports.isOwner = (req, res, next) => {
  if (req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      message: 'Hanya Owner yang dapat mengaktifkan atau memperpanjang lisensi.',
    });
  }
  return next();
};
