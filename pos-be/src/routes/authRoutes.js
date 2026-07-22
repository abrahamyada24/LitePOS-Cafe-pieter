const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/authController');
const upload = require('../middlewares/uploadMiddleware');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: 'LOGIN_RATE_LIMITED',
    message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.',
  },
});
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Manajemen otentikasi user
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user (Admin/Kasir)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 default: admin@pos.com
 *               password:
 *                 type: string
 *                 format: password
 *                 default: 123456
 *     responses:
 *       200:
 *         description: Login berhasil, token diberikan
 *       401:
 *         description: Email atau Password salah
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Mendaftarkan user baru (Support Upload Foto)
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               role:
 *                 type: string
 *                 enum: [ADMIN, CASHIER]
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: User berhasil dibuat
 */
router.post('/register', verifyToken, isAdmin, upload.single('image'), authController.register);

router.put('/change-password', verifyToken, authController.changePassword);

router.get('/me', verifyToken, authController.me);
router.post('/logout', verifyToken, authController.logout);
router.post('/logout-all', verifyToken, authController.logoutAll);
router.get('/sessions', verifyToken, authController.getSessions);
router.delete('/sessions/:id', verifyToken, authController.revokeSession);

module.exports = router;
