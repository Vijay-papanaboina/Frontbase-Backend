import express from "express";
import multer from "multer";
import { uploadProject } from "../../controllers/upload/upload.controller.js";
import authMiddleware from "../../middlewares/auth.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// All routes are prefixed with /api/upload
router.post("/:repo_id", authMiddleware, upload.single("file"), uploadProject);

export default router;




