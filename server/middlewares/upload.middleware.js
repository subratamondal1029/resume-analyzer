import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed!"), false);
    }

    if (file.size > 5 * 1024 * 1024) {
      cb(new Error("File size exceeds limit of 5MB!"), false);
    }

    cb(null, true);
  },
});

const upload = multer({ storage: storage });

export default upload;
