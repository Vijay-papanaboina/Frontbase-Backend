import express from "express";
import multer from "multer";
import { uploadProject } from "../controllers/upload.js";

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), uploadProject);

export default router;
