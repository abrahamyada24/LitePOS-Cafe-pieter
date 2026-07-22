const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../config/auth');

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  imageUrl: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
};

/**
 * 1. GET ALL USERS
 * Mengambil daftar seluruh pegawai untuk manajemen tim.
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 2. UPDATE USER
 * Mengupdate profil pegawai, role, status aktif, atau reset password.
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password, isActive } = req.body;
    const userId = Number(id);

    if (!Number.isInteger(userId)) {
      return res.status(400).json({ success: false, message: 'ID pengguna tidak valid.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    if (targetUser.role === 'OWNER' && req.user.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Hanya Owner yang dapat mengubah akun Owner.' });
    }

    const dataToUpdate = {};

    if (name) dataToUpdate.name = name;
    if (email) dataToUpdate.email = String(email).trim().toLowerCase();
    if (role) {
      const normalizedRole = String(role).toUpperCase();
      if (!['OWNER', 'ADMIN', 'CASHIER'].includes(normalizedRole)) {
        return res.status(400).json({ success: false, message: 'Role pengguna tidak valid.' });
      }
      if (normalizedRole === 'OWNER' && req.user.role !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Hanya Owner yang dapat memberikan role Owner.' });
      }
      dataToUpdate.role = normalizedRole;
    }

    // Konversi string 'true'/'false' dari FormData menjadi Boolean
    if (isActive !== undefined) {
      dataToUpdate.isActive = isActive === 'true' || isActive === true;
    }

    // Jika admin mengisi password baru, lakukan hashing
    if (password && password.trim() !== "") {
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ success: false, message: passwordError });
      dataToUpdate.password = await bcrypt.hash(password, 12);
      dataToUpdate.mustChangePassword = true;
      dataToUpdate.passwordChangedAt = new Date();
    }

    /**
     * LOGIKA PENYIMPANAN LOKAL:
     * Menggunakan req.file.filename untuk menyimpan path relatif folder uploads.
     */
    if (req.file) {
      dataToUpdate.imageUrl = `/uploads/${req.file.filename}`;
    }

    const [, user] = await prisma.$transaction([
      prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: password ? 'ADMIN_PASSWORD_RESET' : 'USER_UPDATED' },
      }),
      prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: publicUserSelect,
      }),
    ]);

    res.json({ success: true, message: "Data pengguna diperbarui", data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 3. DELETE USER
 * Menghapus akun pegawai dari sistem.
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(id);

    // Proteksi: Mencegah admin menghapus akunnya sendiri secara tidak sengaja
    if (req.user.id === userId) {
      return res.status(400).json({ success: false, message: "Akses ditolak! Anda tidak bisa menghapus akun Anda sendiri." });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    if (targetUser.role === 'OWNER') {
      return res.status(403).json({ success: false, message: 'Akun Owner tidak dapat dihapus.' });
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true, message: "Pengguna berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
