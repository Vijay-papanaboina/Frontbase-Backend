import express from "express";
import authMiddleware from "../middlewares/auth.js";
import {
  getRepos,
  deployRepo,
  getDeployments,
  setupRepo,
  getDeploymentStatus,
} from "../controllers/github/index.js";

const router = express.Router();

// GET /api/github/repos - Get all repositories for the logged-in user
router.get("/repos", authMiddleware, getRepos);

// POST /api/github/repos/:repo_id/deploy - Trigger a deployment workflow
router.post("/repos/:repo_id/deploy", authMiddleware, deployRepo);

// GET /api/github/repos/:repo_id/deployments - Get deployment history
router.get("/repos/:repo_id/deployments", authMiddleware, getDeployments);

// GET /api/github/repos/:repo_id/deployment-status - Get latest deployment status (for polling)
router.get(
  "/repos/:repo_id/deployment-status",
  authMiddleware,
  getDeploymentStatus
);

// POST /api/github/repos/:repo_id/setup
router.post("/repos/:repo_id/setup", authMiddleware, setupRepo);

export default router;
