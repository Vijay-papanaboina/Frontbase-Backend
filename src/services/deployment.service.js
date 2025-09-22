import { repositoryRepository } from "../repositories/repository.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { deploymentRepository } from "../repositories/deployment.repository.js";
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
  console.log("📊 Updating deployment status:", {
    repoName,
    ownerLogin,
    repoId,
    userId,
    subdomain,
  });

  // Update repository deployment status
  console.log("🔄 Updating repository status to 'deployed'");
  await repositoryRepository.updateDeployStatus(repoId, "deployed");
  console.log("✅ Repository status updated to 'deployed'");

  // Get repository and user details
  console.log("👤 Fetching repository and user details...");
  const [repo, user] = await Promise.all([
    repositoryRepository.findByNameAndOwner(repoName, ownerLogin),
    userRepository.getUserWithToken(userId),
  ]);

  if (!repo || !user?.githubAccessToken) {
    console.error("❌ Repository or user not found:", {
      repo: !!repo,
      user: !!user,
      hasToken: !!user?.githubAccessToken,
    });
    throw new Error("Repository or user not found");
  }

  console.log("✅ Repository and user details fetched:", {
    repoId: repo.repoId,
    workflowId: repo.deployYmlWorkflowId,
    userId: user.id,
  });

  // Wait for workflow completion and update deployment record
  console.log("⏳ Waiting for workflow completion...");
  const finalRun = await waitForWorkflowCompletion(
    ownerLogin,
    repoName,
    repo.deployYmlWorkflowId,
    user.githubAccessToken
  );

  if (finalRun?.status === "completed") {
    console.log("✅ Workflow completed, recording deployment:", {
      runId: finalRun.id,
      status: finalRun.status,
      conclusion: finalRun.conclusion,
    });
    await recordDeployment(repoId, finalRun, subdomain);
  } else {
    console.log("⚠️ Workflow did not complete or timed out");
  }
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
  console.log("⏳ Starting workflow completion monitoring:", {
    owner,
    repo,
    workflowId,
    maxAttempts: 20,
    delayMs: 5000,
  });

  const maxAttempts = 20;
  const delayMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(
      `🔄 Attempt ${attempt + 1}/${maxAttempts}: Checking workflow status`
    );

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=1`;

    try {
      const data = await githubRequest(url, {}, token);
      const run = data.workflow_runs?.[0];

      console.log("📊 Workflow run status:", {
        runId: run?.id,
        status: run?.status,
        conclusion: run?.conclusion,
        attempt: attempt + 1,
      });

      if (run?.status === "completed") {
        console.log("✅ Workflow completed successfully:", {
          runId: run.id,
          status: run.status,
          conclusion: run.conclusion,
          attempts: attempt + 1,
        });
        return run;
      }
    } catch (error) {
      console.error("❌ Error checking workflow status:", {
        error: error.message,
        attempt: attempt + 1,
        url,
      });
    }

    if (attempt < maxAttempts - 1) {
      console.log(`⏱️ Waiting ${delayMs}ms before next check...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(
    "⏰ Workflow monitoring timed out after",
    maxAttempts,
    "attempts"
  );
  return null;
}

/**
 * Record deployment details in database
 * @param {string} repoId - Repository ID
 * @param {Object} run - Workflow run details
 * @param {string} subdomain - Project subdomain
 */
async function recordDeployment(repoId, run, subdomain) {
  const projectUrl = `https://${subdomain}.frontbase.space`;

  console.log("📝 Recording deployment in database:", {
    repoId,
    workflowRunId: run.id,
    status: run.status,
    conclusion: run.conclusion,
    projectUrl,
    htmlUrl: run.html_url,
  });

  await deploymentRepository.createOrUpdate({
    repoId,
    workflowRunId: run.id,
    status: run.status,
    conclusion: run.conclusion,
    startedAt: run.created_at ? new Date(run.created_at) : null,
    completedAt: run.updated_at ? new Date(run.updated_at) : null,
    htmlUrl: run.html_url,
    projectUrl,
  });

  console.log("✅ Deployment recorded successfully:", {
    repoId,
    projectUrl,
    status: run.status,
    conclusion: run.conclusion,
  });
}
