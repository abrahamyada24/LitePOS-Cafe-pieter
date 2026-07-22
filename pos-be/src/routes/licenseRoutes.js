const express = require('express');
const { rateLimit } = require('express-rate-limit');
const licenseController = require('../controllers/licenseController');
const { verifyToken, isOwner } = require('../middlewares/authMiddleware');

const router = express.Router();
const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    code: 'LICENSE_ACTIVATION_RATE_LIMITED',
    message: 'Terlalu banyak percobaan aktivasi. Coba lagi beberapa menit lagi.',
  },
});

router.get('/status', verifyToken, licenseController.getStatus);
router.post('/activate', activationLimiter, verifyToken, isOwner, licenseController.activate);

module.exports = router;
