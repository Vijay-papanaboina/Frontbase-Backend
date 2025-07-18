import db from "../../db/db.js";

export const deployRepo = async (req, res) => {
  const { repo_id: repoId } = req.params;

  try {
    // Get user's GitHub access token from the database
    const userResult = await db.query(
      'SELECT "githubAccessToken" FROM users WHERE id = $1',
      [req.user.userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.githubAccessToken) {
      return res
        .status(401)
        .json({ message: "GitHub access token not found." });
    }

    // Fetch repository details from database
    const repoResult = await db.query(
      'SELECT * FROM repositories WHERE "repoId" = $1',
      [repoId]
    );
    const repo = repoResult.rows[0];

    if (!repo) {
      return res.status(404).json({ message: "Repository not found." });
    }

    // Fetch repository details from GitHub API
    const urlWithParams2 = new URL(
      `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}`
    );
    const response2 = await fetch(urlWithParams2, {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    });
    const repoData = await response2.json();

    // Trigger deployment workflow
    const urlWithParams3 = new URL(
      `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}/actions/workflows/${repo.deployYmlWorkflowId}/dispatches`
    );
    const response3 = await fetch(urlWithParams3, {
      method: "POST",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    });

    if (!response3.ok) {
      const errorData = await response3.json();
      throw new Error(`Failed to trigger deployment: ${errorData.message}`);
    }

    console.log(`Deployment triggered for ${repo.fullName}`);
    res.status(200).json({ message: "Deployment triggered successfully." });
  } catch (error) {
    console.error(`Failed to trigger deployment for repo ${repoId}:`, error);
    res.status(500).json({ message: "Failed to trigger deployment." });
  }
};

export const getDeployments = async (req, res) => {
  const { repo_id: repoId } = req.params;
  try {
    // Get user's GitHub access token from the database
    const userResult = await db.query(
      'SELECT "githubAccessToken" FROM users WHERE id = $1',
      [req.user.userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.githubAccessToken) {
      return res
        .status(401)
        .json({ message: "GitHub access token not found." });
    }

    // Fetch repository details from database
    const repoResult = await db.query(
      'SELECT * FROM repositories WHERE "repoId" = $1',
      [repoId]
    );
    const repo = repoResult.rows[0];
    if (!repo)
      return res.status(404).json({ message: "Repository not found." });

    // Fetch deployment history from GitHub API
    const urlWithParams4 = new URL(
      `https://api.github.com/repos/${repo.ownerLogin}/${repo.repoName}/actions/workflows/${repo.deployYmlWorkflowId}/runs`
    );
    const response4 = await fetch(urlWithParams4, {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    });
    const data = await response4.json();

    // Remove DB upsert logic here
    // Just return the latest deployment from DB
    const latestDeployment = await db.query(
      'SELECT * FROM deployments WHERE "repoId" = $1 ORDER BY "startedAt" DESC LIMIT 1',
      [repoId]
    );

    res.json(latestDeployment.rows[0] || null);
  } catch (error) {
    console.error(`Failed to fetch deployments for repo ${repoId}:`, error);
    res.status(500).json({ message: "Failed to fetch deployments." });
  }
};

export const getDeploymentStatus = async (req, res) => {
  const { repo_id: repoId } = req.params;
  try {
    const latestDeployment = await db.query(
      'SELECT * FROM deployments WHERE "repoId" = $1 ORDER BY "startedAt" DESC LIMIT 1',
      [repoId]
    );
    if (latestDeployment.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No deployment found for this repo." });
    }
    res.json(latestDeployment.rows[0]);
  } catch (error) {
    console.error(
      `Failed to fetch deployment status for repo ${repoId}:`,
      error
    );
    res.status(500).json({ message: "Failed to fetch deployment status." });
  }
};
