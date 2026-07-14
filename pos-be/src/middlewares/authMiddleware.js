const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.verifyToken = (req, res, next) => {
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
    req.user = decoded;
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
