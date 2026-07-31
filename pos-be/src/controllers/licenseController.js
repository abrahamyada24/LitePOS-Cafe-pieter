const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { activateLicense, getLicenseStatus } = require('../services/licenseService');
const { getDataResetState, resetOperationalData } = require('../services/dataResetService');

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

exports.getResetState = async (req, res) => {
  try {
    const state = await getDataResetState(prisma);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: state });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 'RESET_STATE_FAILED',
      message: 'Status reset data belum dapat diperiksa.',
    });
  }
};

exports.resetData = async (req, res) => {
  try {
    const password = String(req.body?.password || '');
    const confirmation = String(req.body?.confirmation || '').trim();

    if (!password || confirmation !== 'RESET OUTLET') {
      return res.status(400).json({
        success: false,
        code: 'RESET_CONFIRMATION_INVALID',
        message: 'Masukkan password Owner dan ketik RESET OUTLET dengan tepat.',
      });
    }

    const owner = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true, email: true, name: true },
    });
    const passwordMatches = owner && await bcrypt.compare(password, owner.password);
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        code: 'RESET_PASSWORD_INVALID',
        message: 'Password Owner salah.',
      });
    }

    const result = await resetOperationalData({
      prisma,
      resetBy: owner.email || owner.name || `user:${req.user.id}`,
    });

    return res.json({
      success: true,
      message: 'Seluruh data operasional berhasil dihapus.',
      data: result,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      code: error.code || 'DATA_RESET_FAILED',
      message: status === 500
        ? 'Reset data gagal. Tidak ada data yang dihapus sebagian.'
        : error.message,
    });
  }
};
