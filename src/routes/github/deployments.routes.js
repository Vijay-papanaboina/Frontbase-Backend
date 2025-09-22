import express from "express";
import {
  getAllDeployments,
  deployRepository,
  getDeployments,
  getDeploymentStatus,
} from "../../controllers/github/deployments.controller.js";
import authMiddleware from "../../middlewares/auth.js";

const router = express.Router();

// All routes are prefixed with /api/github/deployments
router.get("/", authMiddleware, getAllDeployments);
router.post("/:repo_id", authMiddleware, deployRepository);
router.get("/:repo_id", authMiddleware, getDeployments);
router.get("/:repo_id/status", authMiddleware, getDeploymentStatus);

export default router;
