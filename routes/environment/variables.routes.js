import express from "express";
import {
  getEnvironmentVariables,
  addEnvironmentVariable,
  deleteEnvironmentVariable,
} from "../../controllers/environment/variables.controller.js";
import authMiddleware from "../../middlewares/auth.js";

const router = express.Router();

// All routes are prefixed with /api/environment/variables
router.get("/:repoId", authMiddleware, getEnvironmentVariables);
router.post("/:repoId", authMiddleware, addEnvironmentVariable);
router.delete("/:repoId", authMiddleware, deleteEnvironmentVariable);

export default router;
