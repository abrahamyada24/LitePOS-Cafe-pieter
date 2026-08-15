const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { activateLicense, getLicenseStatus } = require('../services/licenseService');
const { RESET_TYPES, getDataResetState, resetOperationalData } = require('../services/dataResetService');

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
    const parsedSinceVersion = req.query?.sinceVersion === undefined
      ? null
      : Number(req.query.sinceVersion);
    const sinceVersion = Number.isInteger(parsedSinceVersion) && parsedSinceVersion >= 0
      ? parsedSinceVersion
      : null;
    const state = await getDataResetState(prisma, { sinceVersion });
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
    const resetType = String(req.body?.resetType || RESET_TYPES.ALL).trim().toUpperCase();
    const transactionMode = String(req.body?.transactionMode || 'ALL').trim().toUpperCase();
    const confirmationByType = {
      [RESET_TYPES.STOCK]: 'RESET STOK',
      [RESET_TYPES.TRANSACTIONS]: 'RESET TRANSAKSI',
      [RESET_TYPES.ALL]: 'RESET OUTLET',
    };
    const expectedConfirmation = confirmationByType[resetType];

    if (!expectedConfirmation) {
      return res.status(400).json({
        success: false,
        code: 'RESET_TYPE_INVALID',
        message: 'Pilih jenis reset stok, transaksi, atau semua data.',
      });
    }

    let transactionRange = null;
    if (resetType === RESET_TYPES.TRANSACTIONS && transactionMode === 'RANGE') {
      const startDate = String(req.body?.startDate || '').trim();
      const endDate = String(req.body?.endDate || '').trim();
      const isDateOnly = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year
          && date.getUTCMonth() === month - 1
          && date.getUTCDate() === day;
      };
      const startAt = isDateOnly(startDate) ? new Date(`${startDate}T00:00:00.000+07:00`) : null;
      const endAt = isDateOnly(endDate) ? new Date(`${endDate}T23:59:59.999+07:00`) : null;
      const datesMatchInput = startAt && endAt;

      if (!datesMatchInput || startAt > endAt) {
        return res.status(400).json({
          success: false,
          code: 'RESET_RANGE_INVALID',
          message: 'Pilih tanggal awal dan akhir transaksi yang valid.',
        });
      }
      transactionRange = { startAt, endAt, startDate, endDate };
    } else if (resetType === RESET_TYPES.TRANSACTIONS && transactionMode !== 'ALL') {
      return res.status(400).json({
        success: false,
        code: 'RESET_RANGE_INVALID',
        message: 'Cakupan transaksi harus semua transaksi atau rentang tanggal.',
      });
    }

    if (!password || confirmation !== expectedConfirmation) {
      return res.status(400).json({
        success: false,
        code: 'RESET_CONFIRMATION_INVALID',
        message: `Masukkan password Owner dan ketik ${expectedConfirmation} dengan tepat.`,
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
      resetType,
      transactionRange,
    });

    const messageByType = {
      [RESET_TYPES.STOCK]: 'Seluruh stok dan riwayat stok berhasil direset.',
      [RESET_TYPES.TRANSACTIONS]: transactionRange
        ? `Transaksi tanggal ${transactionRange.startDate} sampai ${transactionRange.endDate} berhasil dihapus.`
        : 'Seluruh transaksi berhasil dihapus.',
      [RESET_TYPES.ALL]: 'Seluruh data operasional berhasil dihapus.',
    };

    return res.json({
      success: true,
      message: messageByType[resetType],
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
