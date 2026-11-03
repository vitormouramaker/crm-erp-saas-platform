const multer = require("multer");

// Uploads ficam em memoria (nada em disco) e tem limite de tamanho.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES || 25 * 1024 * 1024),
    files: 10,
  },
});

module.exports = upload;
