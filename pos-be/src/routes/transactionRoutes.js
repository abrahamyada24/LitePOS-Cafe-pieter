const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { verifyToken, isOwner } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   - name: Transactions
 *     description: API Kasir & Transaksi
 */

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Buat transaksi baru (Checkout)
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     qty:
 *                       type: integer
 *               payment:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [CASH, QRIS]
 *                   amount:
 *                     type: number
 *     responses:
 *       201:
 *         description: Transaksi berhasil dibuat
 *       400:
 *         description: Stok kurang atau data tidak valid
 */
router.post('/', verifyToken, transactionController.createTransaction);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Ambil riwayat transaksi (Filter & Pagination)
 *     tags: [Transactions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Halaman ke berapa
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Jumlah data per halaman
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PAID, PENDING, CANCELLED]
 *         description: Filter status transaksi
 *     responses:
 *       200:
 *         description: List transaksi
 */
router.get('/', verifyToken, transactionController.getAllTransactions);

router.get('/pre-orders', verifyToken, transactionController.getPreOrders);
router.get('/:id', verifyToken, transactionController.getTransactionById);
router.post('/notification', transactionController.handleMidtransNotification);
router.post('/:id/return', verifyToken, isOwner, transactionController.returnTransaction);
router.post('/:id/confirm-preorder', verifyToken, transactionController.confirmPreOrder);
router.get('/status/:invoiceNumber', verifyToken, transactionController.checkTransactionStatus);

module.exports = router;
