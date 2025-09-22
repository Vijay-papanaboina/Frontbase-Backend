import express from "express";
import environmentRoutes from "./environment/variables.routes.js";
import githubDeploymentRoutes from "./github/deployments.routes.js";
import githubRepositoryRoutes from "./github/repository.routes.js";
import githubWorkflowRoutes from "./github/workflow.routes.js";
import authRoutes from "./auth/auth.routes.js";
import uploadRoutes from "./upload/upload.routes.js";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// API Documentation endpoint
router.get("/", (req, res) => {
  res.status(200).json({
    version: "1.0.0",
    endpoints: {
      auth: {
        base: "/api/auth",
        routes: [
          {
            path: "/github",
            method: "GET",
            description: "Initiate GitHub OAuth",
          },
          {
            path: "/github/callback",
            method: "GET",
            description: "GitHub OAuth callback",
          },
          { path: "/me", method: "GET", description: "Get current user" },
          { path: "/logout", method: "POST", description: "Logout user" },
        ],
      },
      environment: {
        base: "/api/environment/variables",
        routes: [
          {
            path: "/:repoId",
            method: "GET",
            description: "Get environment variables",
          },
          {
            path: "/:repoId",
            method: "POST",
            description: "Add/update environment variable",
          },
          {
            path: "/:repoId",
            method: "DELETE",
            description: "Delete environment variable",
          },
        ],
      },
      github: {
        deployments: {
          base: "/api/github/deployments",
          routes: [
            { path: "/:repoId", method: "GET", description: "Get deployments" },
            {
              path: "/:repoId/status",
              method: "GET",
              description: "Get deployment status",
            },
          ],
        },
        repositories: {
          base: "/api/github/repositories",
          routes: [
            { path: "/", method: "GET", description: "Get all repositories" },
            {
              path: "/:repoId",
              method: "GET",
              description: "Get repository by ID",
            },
          ],
        },
        workflows: {
          base: "/api/github/workflows",
          routes: [
            {
              path: "/:repoId/setup",
              method: "POST",
              description: "Setup workflow",
            },
            {
              path: "/:repoId/redeploy",
              method: "POST",
              description: "Trigger redeploy",
            },
          ],
        },
      },
      upload: {
        base: "/api/upload",
        routes: [
          {
            path: "/:repoId",
            method: "POST",
            description: "Upload project files",
          },
        ],
      },
    },
  });
});

// Mount routes
router.use("/api/environment/variables", environmentRoutes);
router.use("/api/github/deployments", githubDeploymentRoutes);
router.use("/api/github/repositories", githubRepositoryRoutes);
router.use("/api/github/workflows", githubWorkflowRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/upload", uploadRoutes);

export default router;
