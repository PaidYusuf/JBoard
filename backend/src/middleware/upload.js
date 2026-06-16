const multer = require('multer');

// Files land in memory first so we can inspect magic bytes before touching the filesystem
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB hard cap
});

module.exports = upload;
