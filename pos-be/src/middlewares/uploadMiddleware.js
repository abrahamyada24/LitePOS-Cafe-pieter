const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadDir } = require('../config/storage');

/**
 * LOGIKA PENYIMPANAN LOKAL (Disk Storage)
 * Gambar akan disimpan secara fisik di folder: pos-be/public/uploads
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate nama file unik: asset-timestamp-random.ekstensi
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter file untuk memastikan hanya gambar yang boleh diupload
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Format file tidak didukung! Gunakan JPG, PNG, atau WEBP.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Batasi 2MB agar penyimpanan lokal tidak cepat penuh
    fileFilter: fileFilter
});

module.exports = upload;
