const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');

// Route Publik: GET /api/catalog
// Tidak menggunakan middleware verifyToken karena ini untuk pengunjung umum
router.get('/', catalogController.getPublicCatalog);
router.post('/table-order', catalogController.createTableOrder);
router.get('/table-order/:orderCode/status', catalogController.getTableOrderStatus);

module.exports = router;
