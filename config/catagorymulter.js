const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/catagory");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const uploadCategory = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

module.exports = uploadCategory;