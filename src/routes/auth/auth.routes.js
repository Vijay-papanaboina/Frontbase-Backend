import express from "express";
import authMiddleware from "../../middlewares/auth.js";
import {
  githubLogin,
  githubCallback,
  getMe,
  logout,
} from "../../controllers/auth/auth.controller.js";

const router = express.Router();

// All routes are prefixed with /api/auth
router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);
router.get("/me", authMiddleware, getMe);
router.post("/logout", logout);

export default router;
