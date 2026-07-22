const { PrismaClient } = require('@prisma/client');
const { activateLicense, getLicenseStatus } = require('../services/licenseService');

const prisma = new PrismaClient();

exports.getStatus = async (req, res) => {
  try {
    const license = await getLicenseStatus(prisma, { useCache: false });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: license });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Status lisensi belum dapat diperiksa.' });
  }
};

exports.activate = async (req, res) => {
  try {
    const license = await activateLicense({
      prisma,
      code: req.body?.code,
      userEmail: req.user.email,
    });
    return res.json({ success: true, message: 'Lisensi outlet berhasil diperpanjang.', data: license });
  } catch (error) {
    const status = error.code === 'INVALID_LICENSE_CODE' ? 400 : 500;
    return res.status(status).json({
      success: false,
      code: error.code || 'LICENSE_ACTIVATION_FAILED',
      message: error.code === 'INVALID_LICENSE_CODE' ? error.message : 'Lisensi belum dapat diaktifkan.',
    });
  }
};
