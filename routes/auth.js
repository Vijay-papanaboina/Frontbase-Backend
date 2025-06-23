import express from "express";
import authMiddleware from "../middlewares/auth.js";
import {
  githubLogin,
  githubCallback,
  getMe,
  logout,
} from "../controllers/auth.js";

const router = express.Router();

router.get("/github", githubLogin);

router.get("/github/callback", githubCallback);

router.get("/me", authMiddleware, getMe);

router.post("/logout", logout);

export default router;
