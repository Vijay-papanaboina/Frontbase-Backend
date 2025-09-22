import { userRepository } from "../../repositories/user.repository.js";
import { repositoryRepository } from "../../repositories/repository.repository.js";
import { envVarRepository } from "../../repositories/envVar.repository.js";
import { injectRepoSecret } from "../../services/github.service.js";
import { readWorkflowTemplate } from "../../services/file.service.js";
import { env } from "../../config/environment.js";
import { JWT_CONFIG } from "../../utils/constants.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import jwt from "jsonwebtoken";

/**
 * Set up a new deployment workflow for a repository
 */
export const setupWorkflow = asyncHandler(async (req, res) => {
  const { repoId } = req.params;
  const {
    repoName,
    ownerLogin,
    envVars,
    framework,
    buildCommand,
    outputFolder,
  } = req.body || {};

  // Validate required fields
  if (!repoName || !ownerLogin) {
    return res.status(400).json({
      message: "Missing required fields: repoName and ownerLogin",
    });
  }

  if (!buildCommand || !outputFolder) {
    return res.status(400).json({
      message: "Missing required fields: buildCommand and outputFolder",
    });
  }

  // Get user details
  const user = await userRepository.getUserWithToken(req.user.userId);
  if (!user) {
    return res.status(401).json({ message: "User not found or unauthorized" });
  }

  // Validate user object has required properties
  if (!user.email || !user.githubId) {
    console.error("User object missing required properties:", {
      email: user.email,
      githubId: user.githubId,
      user: user,
    });
    return res.status(400).json({
      message: "User data incomplete. Please re-authenticate.",
    });
  }

  // Create or update repository record
  await repositoryRepository.createOrUpdate({
    repoId,
    repoName,
    ownerLogin,
    userId: req.user.userId,
    deployYmlInjected: false,
    deployStatus: "pending",
  });

  // Verify repository access
  const repoAccess = await verifyRepositoryAccess(
    ownerLogin,
    repoName,
    user.githubAccessToken
  );
  if (!repoAccess.hasAccess) {
    return res.status(403).json({ message: repoAccess.message });
  }

  // Generate and inject repo secret for env vars
  const repoJwt = jwt.sign(
    { repoId, userId: req.user.userId },
    env.JWT_SECRET,
    {
      expiresIn: JWT_CONFIG.REPO_TOKEN_EXPIRES_IN,
    }
  );

  console.log("🔐 Setting up repository secret:", {
    ownerLogin,
    repoName,
    secretName: "ENV_ACCESS_TOKEN",
    tokenLength: repoJwt.length,
    expiresIn: JWT_CONFIG.REPO_TOKEN_EXPIRES_IN,
  });

  try {
    await injectRepoSecret(
      ownerLogin,
      repoName,
      "ENV_ACCESS_TOKEN",
      repoJwt,
      user.githubAccessToken
    );
    console.log("✅ Repository secret injected successfully");
  } catch (error) {
    console.error("❌ Failed to inject repository secret:", {
      error: error.message,
      ownerLogin,
      repoName,
    });
    throw error;
  }

  // Handle environment variables
  if (envVars?.length > 0) {
    await handleEnvironmentVariables(envVars, repoId, req.user.userId);
  }

  // Create and inject workflow file
  const workflowId = await createWorkflowFile({
    ownerLogin,
    repoName,
    user,
    repoId,
    buildCommand,
    outputFolder,
  });

  // Update repository status
  await repositoryRepository.updateWorkflowInfo(repoId, workflowId);

  // Trigger the workflow immediately after setup
  try {
    await triggerWorkflowDispatch(
      ownerLogin,
      repoName,
      workflowId,
      user.githubAccessToken
    );
    console.log(`Workflow triggered for ${ownerLogin}/${repoName}`);
  } catch (error) {
    console.error("Failed to trigger workflow:", error);
    // Don't fail the setup if trigger fails, just log it
  }

  res.status(200).json({
    message: "Workflow setup completed successfully",
    workflowId,
  });
});

/**
 * Trigger a workflow redeployment
 */
export const redeployWorkflow = asyncHandler(async (req, res) => {
  const { repoId } = req.params;
  const { commitSha } = req.body;

  // Get repository details
  const repo = await repositoryRepository.findByIdAndUser(
    repoId,
    req.user.userId
  );
  if (!repo) {
    return res.status(404).json({ message: "Repository not found" });
  }

  // Get user's GitHub token
  const user = await userRepository.getUserWithToken(req.user.userId);
  if (!user?.githubAccessToken) {
    return res.status(401).json({ message: "GitHub access token not found" });
  }

  // Trigger workflow
  await triggerWorkflowDispatch(
    repo.ownerLogin,
    repo.repoName,
    repo.deployYmlWorkflowId,
    user.githubAccessToken,
    commitSha
  );

  res.status(200).json({ message: "Redeployment triggered successfully" });
});

// Helper functions

export async function getUserWithGithubToken(userId) {
  return await userRepository.getUserWithToken(userId);
}

async function verifyRepositoryAccess(ownerLogin, repoName, token) {
  const response = await fetch(
    `https://api.github.com/repos/${ownerLogin}/${repoName}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    return {
      hasAccess: false,
      message: "Repository not found or no access",
    };
  }

  const repoData = await response.json();
  if (!repoData.permissions?.push) {
    return {
      hasAccess: false,
      message: "No push permission to repository",
    };
  }

  return { hasAccess: true };
}

async function handleEnvironmentVariables(envVars, repoId, userId) {
  // Remove existing env vars
  await envVarRepository.deleteByRepoId(repoId, userId);

  // Insert new env vars
  const envVarData = envVars
    .filter((env) => env.key?.trim())
    .map((env) => ({
      userId,
      repoId,
      key: env.key,
      value: env.value,
    }));

  if (envVarData.length > 0) {
    await envVarRepository.bulkCreate(envVarData);
  }
}

async function createWorkflowFile({
  ownerLogin,
  repoName,
  user,
  repoId,
  buildCommand,
  outputFolder,
}) {
  // Read and process template
  const template = await readWorkflowTemplate();

  // Debug: Log template content and replacement values
  console.log("Template content length:", template.length);
  console.log("Template replacement values:", {
    BACKEND_URL: env.BACKEND_URL,
    PROJECT_SLUG: `${ownerLogin}-${repoName}`,
    OWNER_LOGIN: ownerLogin,
    REPO_NAME: repoName,
    USER_EMAIL: user.email,
    GITHUB_ID: user.githubId,
    REPO_ID: repoId,
    BUILD_COMMAND: buildCommand,
    BUILD_DIR: outputFolder,
  });

  const content = template
    .replace(/{{BACKEND_URL}}/g, env.BACKEND_URL)
    .replace(/{{PROJECT_SLUG}}/g, `${ownerLogin}-${repoName}`)
    .replace(/{{OWNER_LOGIN}}/g, ownerLogin)
    .replace(/{{REPO_NAME}}/g, repoName)
    .replace(/{{USER_EMAIL}}/g, user.email)
    .replace(/{{GITHUB_ID}}/g, user.githubId)
    .replace(/{{REPO_ID}}/g, repoId)
    .replace(/{{BUILD_COMMAND}}/g, buildCommand)
    .replace(/{{BUILD_DIR}}/g, outputFolder);

  // Check for unprocessed template variables (excluding GitHub Actions variables)
  const unprocessedMatches = content.match(/\{\{[^}]+\}\}/g);
  if (unprocessedMatches) {
    // Filter out GitHub Actions variables that should not be replaced
    const githubActionsVars = [
      "env.NODE_VERSION",
      "secrets.ENV_ACCESS_TOKEN",
      "env.CI",
    ];
    const invalidVars = unprocessedMatches.filter((match) => {
      const varName = match.replace(/\{\{|\}\}/g, "").trim();
      return !githubActionsVars.includes(varName);
    });

    if (invalidVars.length > 0) {
      console.error("Invalid unprocessed template variables:", invalidVars);
      console.error("Processed content preview:", content.substring(0, 500));
      throw new Error(
        `Invalid template variables found: ${invalidVars.join(", ")}`
      );
    }
  }

  const encodedContent = Buffer.from(content).toString("base64");
  const workflowPath = ".github/workflows/deploy.yml";

  // Create or update workflow file
  await createOrUpdateGithubFile(
    ownerLogin,
    repoName,
    workflowPath,
    encodedContent,
    user.githubAccessToken
  );

  // Get workflow ID
  return await getWorkflowId(ownerLogin, repoName, user.githubAccessToken);
}

async function createOrUpdateGithubFile(owner, repo, path, content, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // Try to get existing file
  const getResponse = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github.v3+json",
    },
  });

  const method = getResponse.ok ? "PUT" : "POST";
  const body = getResponse.ok
    ? {
        message: "Update workflow file",
        content,
        sha: (await getResponse.json()).sha,
      }
    : {
        message: "Create workflow file",
        content,
      };

  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github.v3+json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Failed to create/update workflow file");
  }
}

async function getWorkflowId(owner, repo, token) {
  let attempts = 0;
  const maxAttempts = 5;
  const delay = 3000; // 3 seconds

  while (attempts < maxAttempts) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (response.ok) {
      const { workflows } = await response.json();
      const workflow = workflows.find(
        (w) => w.path === ".github/workflows/deploy.yml"
      );
      if (workflow) return workflow.id;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    attempts++;
  }

  throw new Error("Could not get workflow ID after multiple attempts");
}

async function triggerWorkflowDispatch(
  owner,
  repo,
  workflowId,
  token,
  commitSha
) {
  const ref = commitSha || "main";
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github.v3+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to trigger workflow: ${error.message}`);
  }
}
