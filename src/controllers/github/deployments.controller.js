import { userRepository } from "../../repositories/user.repository.js";
import { repositoryRepository } from "../../repositories/repository.repository.js";
import { deploymentRepository } from "../../repositories/deployment.repository.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";

/**
 * Get all deployments for the authenticated user
 */
export const getAllDeployments = asyncHandler(async (req, res) => {
  // Get all deployments for the user
  const deployments = await deploymentRepository.findByUser(req.user.userId);

  // Get repository details for each deployment
  const deploymentsWithRepos = await Promise.all(
    deployments.map(async (deployment) => {
      const repo = await repositoryRepository.findByIdAndUser(
        deployment.repoId,
        req.user.userId
      );
      return {
        ...deployment,
        repository: repo
          ? {
              id: repo.repoId,
              name: repo.repoName,
              owner: repo.ownerLogin,
              fullName: repo.fullName,
              htmlUrl: repo.htmlUrl,
            }
          : null,
      };
    })
  );

  // Sort by createdAt desc
  deploymentsWithRepos.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json(deploymentsWithRepos);
});

export const deployRepository = asyncHandler(async (req, res) => {
  const { repo_id: repoId } = req.params;

  // Get user's GitHub access token
  const user = await userRepository.getUserWithToken(req.user.userId);
  if (!user?.githubAccessToken) {
    return res.status(401).json({ message: "GitHub access token not found." });
  }

  // Get repository details
  const repo = await repositoryRepository.findByIdAndUser(
    repoId,
    req.user.userId
  );
  if (!repo) {
    return res.status(404).json({ message: "Repository not found." });
  }

  // Fetch repository details from GitHub API
  const githubResponse = await fetch(
    `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!githubResponse.ok) {
    throw new Error("Failed to fetch repository from GitHub");
  }

  // Trigger deployment workflow
  const workflowResponse = await fetch(
    `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}/actions/workflows/${repo.deployYmlWorkflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (!workflowResponse.ok) {
    const errorData = await workflowResponse.json();
    throw new Error(`Failed to trigger deployment: ${errorData.message}`);
  }

  console.log(`Deployment triggered for ${repo.fullName}`);
  res.status(200).json({ message: "Deployment triggered successfully." });
});

export const getDeployments = asyncHandler(async (req, res) => {
  const { repo_id: repoIdNumber } = req.params;

  // Get user's GitHub access token
  const user = await userRepository.getUserWithToken(req.user.userId);
  if (!user?.githubAccessToken) {
    return res.status(401).json({ message: "GitHub access token not found." });
  }

  // Get repository details
  const repo = await repositoryRepository.findByIdAndUser(
    repoIdNumber,
    req.user.userId
  );
  if (!repo) {
    return res.status(404).json({ message: "Repository not found." });
  }

  // Fetch deployment history from GitHub API
  const githubResponse = await fetch(
    `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}/actions/workflows/${repo.deployYmlWorkflowId}/runs`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!githubResponse.ok) {
    throw new Error("Failed to fetch deployments from GitHub");
  }

  // Get latest deployment from database
  const latestDeployment = await deploymentRepository.findByRepoId(repoId);
  res.json(latestDeployment || null);
});

export const getDeploymentStatus = asyncHandler(async (req, res) => {
  const { repo_id: repoId } = req.params;
  const repoIdNumber = parseInt(repoId, 10);

  // Get user's GitHub access token
  const user = await userRepository.getUserWithToken(req.user.userId);
  if (!user?.githubAccessToken) {
    return res.status(401).json({ message: "GitHub access token not found." });
  }

  // Get repository details
  const repo = await repositoryRepository.findByIdAndUser(
    repoIdNumber,
    req.user.userId
  );
  if (!repo) {
    return res.status(404).json({ message: "Repository not found." });
  }

  // Check if deployment record exists in database
  const deployment = await deploymentRepository.findByRepoId(repoIdNumber);
  if (deployment) {
    // If deployment exists but is still queued/in_progress, check GitHub for updates
    if (deployment.status === "queued" || deployment.status === "in_progress") {
      try {
        console.log("Checking workflow run:", {
          repoIdNumber,
          workflowRunId: deployment.workflowRunId,
          repo: `${repo.ownerLogin}/${repo.repoName}`,
        });

        const githubResponse = await fetch(
          `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}/actions/runs/${deployment.workflowRunId}`,
          {
            method: "GET",
            headers: {
              authorization: `Bearer ${user.githubAccessToken}`,
              accept: "application/vnd.github.v3+json",
            },
          }
        );

        if (githubResponse.ok) {
          const workflowRun = await githubResponse.json();

          console.log("GitHub workflow run status:", {
            id: workflowRun.id,
            status: workflowRun.status,
            conclusion: workflowRun.conclusion,
            created_at: workflowRun.created_at,
            updated_at: workflowRun.updated_at,
          });

          // Update deployment status if it has changed
          if (
            workflowRun.status !== deployment.status ||
            workflowRun.conclusion !== deployment.conclusion
          ) {
            console.log("Updating deployment status:", {
              oldStatus: deployment.status,
              newStatus: workflowRun.status,
              oldConclusion: deployment.conclusion,
              newConclusion: workflowRun.conclusion,
            });

            const updatedDeployment = await deploymentRepository.updateStatus(
              repoIdNumber,
              workflowRun.status,
              workflowRun.conclusion
            );
            return res.json(updatedDeployment);
          }
        } else {
          console.error(
            "Failed to fetch workflow run:",
            githubResponse.status,
            await githubResponse.text()
          );
        }
      } catch (error) {
        console.error("Error checking workflow run status:", error);
      }
    }

    return res.json(deployment);
  }

  // If no deployment record exists, check GitHub workflow runs
  if (repo.deployYmlWorkflowId) {
    try {
      const githubResponse = await fetch(
        `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}/actions/workflows/${repo.deployYmlWorkflowId}/runs?per_page=1`,
        {
          method: "GET",
          headers: {
            authorization: `Bearer ${user.githubAccessToken}`,
            accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (githubResponse.ok) {
        const workflowRuns = await githubResponse.json();
        if (
          workflowRuns.workflow_runs &&
          workflowRuns.workflow_runs.length > 0
        ) {
          const latestRun = workflowRuns.workflow_runs[0];

          // Create deployment record if it doesn't exist
          const newDeployment = await deploymentRepository.createOrUpdate({
            repoIdNumber: parseInt(repoIdNumber),
            workflowRunId: latestRun.id,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            startedAt: latestRun.created_at
              ? new Date(latestRun.created_at)
              : null,
            completedAt: latestRun.updated_at
              ? new Date(latestRun.updated_at)
              : null,
            htmlUrl: latestRun.html_url,
            projectUrl: repo.projectUrl,
          });

          return res.json(newDeployment);
        }
      }
    } catch (error) {
      console.error("Error fetching workflow runs:", error);
    }
  }

  // Return a pending status if no deployment is found
  res.json({
    status: "pending",
    conclusion: null,
    message: "Deployment not yet started",
  });
});
