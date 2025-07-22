import db from "../db/db.js";
import { githubRequest } from "./github.service.js";

/**
 * Update deployment status and record deployment details
 * @param {Object} params - Deployment parameters
 */
export async function updateDeploymentStatus({
  repoName,
  ownerLogin,
  repoId,
  userId,
  subdomain,
}) {
  // Update repository deployment status
  await db.query(
    `UPDATE repositories SET "deployStatus" = 'deployed'
     WHERE "repoName" = $1 AND "ownerLogin" = $2`,
    [repoName, ownerLogin]
  );

  // Get repository and user details
  const [repo, user] = await Promise.all([
    getRepositoryDetails(repoName, ownerLogin),
    getUserToken(userId),
  ]);

  if (!repo || !user?.githubAccessToken) {
    throw new Error("Repository or user not found");
  }

  // Wait for workflow completion and update deployment record
  const finalRun = await waitForWorkflowCompletion(
    ownerLogin,
    repoName,
    repo.deployYmlWorkflowId,
    user.githubAccessToken
  );

  if (finalRun?.status === "completed") {
    await recordDeployment(repoId, finalRun, subdomain);
  }
}

/**
 * Get repository details from database
 * @param {string} repoName - Repository name
 * @param {string} ownerLogin - Repository owner
 * @returns {Promise<Object>} Repository details
 */
async function getRepositoryDetails(repoName, ownerLogin) {
  const result = await db.query(
    'SELECT * FROM repositories WHERE "repoName" = $1 AND "ownerLogin" = $2',
    [repoName, ownerLogin]
  );
  return result.rows[0];
}

/**
 * Get user's GitHub access token
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User details
 */
async function getUserToken(userId) {
  const result = await db.query(
    'SELECT "githubAccessToken" FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

/**
 * Wait for workflow run to complete
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} workflowId - Workflow ID
 * @param {string} token - GitHub token
 * @returns {Promise<Object>} Workflow run details
 */
async function waitForWorkflowCompletion(owner, repo, workflowId, token) {
  const maxAttempts = 20;
  const delayMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=1`;

    try {
      const data = await githubRequest(url, {}, token);
      const run = data.workflow_runs?.[0];

      if (run?.status === "completed") {
        return run;
      }
    } catch (error) {
      console.error("Error checking workflow status:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

/**
 * Record deployment details in database
 * @param {string} repoId - Repository ID
 * @param {Object} run - Workflow run details
 * @param {string} subdomain - Project subdomain
 */
async function recordDeployment(repoId, run, subdomain) {
  await db.query(
    `INSERT INTO deployments (
      "repoId", "workflowRunId", status, conclusion,
      "startedAt", "completedAt", "htmlUrl", "projectUrl"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT ("repoId") DO UPDATE SET
      "workflowRunId" = EXCLUDED."workflowRunId",
      status = EXCLUDED.status,
      conclusion = EXCLUDED.conclusion,
      "startedAt" = EXCLUDED."startedAt",
      "completedAt" = EXCLUDED."completedAt",
      "htmlUrl" = EXCLUDED."htmlUrl",
      "projectUrl" = EXCLUDED."projectUrl"`,
    [
      repoId,
      run.id,
      run.status,
      run.conclusion,
      run.created_at,
      run.updated_at,
      run.html_url,
      `https://${subdomain}.frontbase.space`,
    ]
  );
}
