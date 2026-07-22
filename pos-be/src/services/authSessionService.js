const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_ABSOLUTE_TIMEOUT_MS,
} = require('../config/auth');

const createAuthSession = async ({ prisma, user, clientType, deviceName, ipAddress, userAgent }) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS);
  const sessionId = crypto.randomUUID();
  const jwtId = crypto.randomUUID();
  const ipHash = ipAddress
    ? crypto.createHmac('sha256', process.env.JWT_SECRET).update(ipAddress).digest('hex')
    : null;

  const session = await prisma.authSession.create({
    data: {
      id: sessionId,
      jwtId,
      userId: user.id,
      clientType,
      deviceName: deviceName ? String(deviceName).trim().slice(0, 150) : null,
      ipHash,
      userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
      lastSeenAt: now,
      expiresAt,
    },
  });

  const token = jwt.sign(
    {
      sid: session.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      audience: JWT_AUDIENCE,
      expiresIn: Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000),
      issuer: JWT_ISSUER,
      jwtid: jwtId,
      subject: String(user.id),
    },
  );

  return { session, token };
};

const revokeSession = (prisma, sessionId, reason = 'LOGOUT') => prisma.authSession.updateMany({
  where: { id: sessionId, revokedAt: null },
  data: { revokedAt: new Date(), revokeReason: reason },
});

const revokeAllUserSessions = (prisma, userId, reason = 'LOGOUT_ALL') => prisma.authSession.updateMany({
  where: { userId, revokedAt: null },
  data: { revokedAt: new Date(), revokeReason: reason },
});

module.exports = {
  createAuthSession,
  revokeAllUserSessions,
  revokeSession,
};
