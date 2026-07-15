const express = require('express');
const router = express.Router();
const controller = require('../controllers/kitchenOrderController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, controller.getKitchenOrders);
router.get('/summary', verifyToken, controller.getKitchenOrderSummary);
router.patch('/:id/status', verifyToken, controller.updateKitchenOrderStatus);

module.exports = router;
