const { PrismaClient } = require('@prisma/client');
const { getLicenseStatus } = require('../services/licenseService');

const prisma = new PrismaClient();

exports.requireActiveLicense = async (req, res, next) => {
  if (req.path === '/health') return next();
  try {
    const license = await getLicenseStatus(prisma);
    if (license.isActive) return next();
    return res.status(402).json({
      success: false,
      code: license.status === 'SUSPENDED' ? 'LICENSE_SUSPENDED' : 'LICENSE_EXPIRED',
      message: license.status === 'SUSPENDED'
        ? 'Lisensi outlet sedang ditangguhkan. Hubungi pengelola LitePOS.'
        : 'Masa aktif lisensi outlet telah berakhir. Owner perlu memperpanjang lisensi.',
      license,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      code: 'LICENSE_CHECK_UNAVAILABLE',
      message: 'Status lisensi belum dapat diverifikasi.',
    });
  }
};
