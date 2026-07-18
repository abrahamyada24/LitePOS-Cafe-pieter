const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middlewares/uploadMiddleware');
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
router.post('/login', authController.login);

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

module.exports = router;
