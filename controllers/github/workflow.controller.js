import db from "../../db/db.js";
import { injectRepoSecret } from "../../services/github.service.js";
import { readWorkflowTemplate } from "../../services/file.service.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Set up a new deployment workflow for a repository
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const setupWorkflow = async (req, res) => {
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

  try {
    // Get user details
    const user = await getUserWithGithubToken(req.user.userId);
    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found or unauthorized" });
    }

    // Create or update repository record
    await createOrUpdateRepository(
      repoId,
      repoName,
      ownerLogin,
      req.user.userId
    );

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
    const repoJwt = jwt.sign({ repoId, userId: req.user.userId }, JWT_SECRET, {
      expiresIn: "1y",
    });
    await injectRepoSecret(
      ownerLogin,
      repoName,
      "ENV_ACCESS_TOKEN",
      repoJwt,
      user.githubAccessToken
    );

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
    await updateRepositoryStatus(repoId, workflowId);

    res.status(200).json({
      message: "Workflow setup completed successfully",
      workflowId,
    });
  } catch (error) {
    console.error("Error setting up workflow:", error);
    res.status(500).json({
      message: "Failed to set up workflow",
      error: error.message,
    });
  }
};

/**
 * Trigger a workflow redeployment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const redeployWorkflow = async (req, res) => {
  const { repoId } = req.params;
  const { commitSha } = req.body;

  try {
    // Get repository details
    const repo = await getRepositoryById(repoId, req.user.userId);
    if (!repo) {
      return res.status(404).json({ message: "Repository not found" });
    }

    // Get user's GitHub token
    const user = await getUserWithGithubToken(req.user.userId);
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
  } catch (error) {
    console.error(`Failed to trigger redeployment for repo ${repoId}:`, error);
    res.status(500).json({ message: "Failed to trigger redeployment" });
  }
};

// Helper functions

export async function getUserWithGithubToken(userId) {
  const result = await db.query(
    'SELECT "githubAccessToken", "githubId", email, id FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

async function getRepositoryById(repoId, userId) {
  const result = await db.query(
    'SELECT * FROM repositories WHERE "repoId" = $1 AND "userId" = $2',
    [repoId, userId]
  );
  return result.rows[0];
}

async function createOrUpdateRepository(repoId, repoName, ownerLogin, userId) {
  await db.query(
    `INSERT INTO repositories ("repoId", "repoName", "ownerLogin", "userId", "deployYmlInjected", "deployStatus")
     VALUES ($1, $2, $3, $4, FALSE, 'pending')
     ON CONFLICT ("repoId") DO NOTHING`,
    [repoId, repoName, ownerLogin, userId]
  );
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
  await db.query(
    'DELETE FROM repo_env_vars WHERE "userId" = $1 AND "repoId" = $2',
    [userId, repoId]
  );

  // Insert new env vars
  for (const env of envVars) {
    if (env.key?.trim()) {
      await db.query(
        'INSERT INTO repo_env_vars ("userId", "repoId", "key", "value") VALUES ($1, $2, $3, $4)',
        [userId, repoId, env.key, env.value]
      );
    }
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
  const content = template
    .replace(/{{BACKEND_URL}}/g, process.env.BACKEND_URL)
    .replace(/{{PROJECT_SLUG}}/g, `${ownerLogin}-${repoName}`)
    .replace(/{{OWNER_LOGIN}}/g, ownerLogin)
    .replace(/{{REPO_NAME}}/g, repoName)
    .replace(/{{USER_EMAIL}}/g, user.email)
    .replace(/{{GITHUB_ID}}/g, user.githubId)
    .replace(/{{REPO_ID}}/g, repoId)
    .replace(/{{BUILD_COMMAND}}/g, buildCommand)
    .replace(/{{BUILD_DIR}}/g, outputFolder);

  if (content.includes("{{")) {
    throw new Error("Unprocessed template variables found");
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

async function updateRepositoryStatus(repoId, workflowId) {
  await db.query(
    `UPDATE repositories 
     SET "deployYmlInjected" = TRUE, "deployYmlWorkflowId" = $1 
     WHERE "repoId" = $2`,
    [workflowId, repoId]
  );
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
