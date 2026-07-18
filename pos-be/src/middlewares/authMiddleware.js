const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const JWT_SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();

exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak! Token tidak ditemukan."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, role: true, isActive: true }
    });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Akun tidak ditemukan atau sudah dinonaktifkan. Silakan login kembali."
      });
    }
    req.user = { id: user.id, name: user.name, role: user.role };
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Token tidak valid atau kadaluarsa."
    });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      message: "Akses ditolak! Hanya Admin/Owner yang boleh melakukan ini."
    });
  }
  next();
};
