const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(verifyToken);

router.get('/', packageController.getAllPackages);
router.get('/:id', packageController.getPackageById);
router.post('/', upload.single('image'), packageController.createPackage);
router.put('/:id', upload.single('image'), packageController.updatePackage);
router.delete('/:id', packageController.deletePackage);

module.exports = router;
