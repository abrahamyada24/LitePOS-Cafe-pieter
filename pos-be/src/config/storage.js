const path = require('path');

const defaultUploadDir = path.join(__dirname, '../../public/uploads');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || defaultUploadDir);

module.exports = { uploadDir };
