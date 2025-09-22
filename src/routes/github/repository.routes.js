import express from "express";
import {
  getRepositories,
  getRepositoryById,
  getRecentCommits,
} from "../../controllers/github/repository.controller.js";
import authMiddleware from "../../middlewares/auth.js";

const router = express.Router();

// All routes are prefixed with /api/github/repositories
router.get("/", authMiddleware, getRepositories);
router.get("/:repoId", authMiddleware, getRepositoryById);
// GET /:repoId/commits - Get recent commits for a repository
router.get("/:repoId/commits", authMiddleware, getRecentCommits);

export default router;
