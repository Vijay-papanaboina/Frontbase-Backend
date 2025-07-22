import express from "express";
import {
  setupWorkflow,
  redeployWorkflow,
} from "../../controllers/github/workflow.controller.js";
import authMiddleware from "../../middlewares/auth.js";

const router = express.Router();

// All routes are prefixed with /api/github/workflows
router.post("/:repoId/setup", authMiddleware, setupWorkflow);
// POST /:repoId/redeploy
// Body: { commitSha?: string }
// Triggers redeploy of the workflow, optionally for a specific commit
router.post("/:repoId/redeploy", authMiddleware, redeployWorkflow);

export default router;
