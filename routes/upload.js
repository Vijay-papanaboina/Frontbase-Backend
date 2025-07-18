import express from "express";
import multer from "multer";
import { uploadProject } from "../controllers/upload.js";
import authMiddleware from "../middlewares/auth.js";

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/", authMiddleware, upload.single("file"), uploadProject);

export default router;
