import db from "../../db/db.js";
import { getRepoCommits } from "../../services/github.service.js";
import { getUserWithGithubToken } from "./workflow.controller.js";

/**
 * Get all repositories for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getRepositories = async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT "githubAccessToken" FROM users WHERE id = $1',
      [req.user.userId]
    );

    const user = userResult.rows[0];
    if (!user?.githubAccessToken) {
      return res
        .status(401)
        .json({ message: "GitHub access token not found." });
    }

    // Fetch repositories from GitHub API
    const githubResponse = await fetch("https://api.github.com/user/repos", {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    });

    if (!githubResponse.ok) {
      throw new Error("Failed to fetch repositories from GitHub");
    }

    const repositories = await githubResponse.json();

    // Get deployment status from database
    const dbRepos = await db.query(
      'SELECT "repoId", "deployYmlInjected", "deployStatus" FROM repositories WHERE "userId" = $1',
      [req.user.userId]
    );

    // Create lookup maps for status
    const statusMap = dbRepos.rows.reduce(
      (acc, repo) => ({
        ...acc,
        [repo.repoId]: {
          deployYmlInjected: repo.deployYmlInjected || false,
          deployStatus: repo.deployStatus || "not-deployed",
        },
      }),
      {}
    );

    // Combine GitHub data with deployment status
    const enrichedRepos = repositories.map((repo) => ({
      ...repo,
      deployYmlInjected: statusMap[repo.id]?.deployYmlInjected || false,
      deployStatus: statusMap[repo.id]?.deployStatus || "not-deployed",
    }));

    res.json({ repositories: enrichedRepos });
  } catch (error) {
    console.error("Failed to fetch repositories:", error);
    res.status(500).json({ message: "Failed to fetch repositories." });
  }
};

/**
 * Get a single repository by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getRepositoryById = async (req, res) => {
  const { repoId } = req.params;
  try {
    const repoResult = await db.query(
      'SELECT * FROM repositories WHERE "repoId" = $1 AND "userId" = $2',
      [repoId, req.user.userId]
    );

    if (!repoResult.rows[0]) {
      return res.status(404).json({ message: "Repository not found." });
    }

    res.json(repoResult.rows[0]);
  } catch (error) {
    console.error(`Failed to fetch repository ${repoId}:`, error);
    res.status(500).json({ message: "Failed to fetch repository." });
  }
};

// Internal DB lookup helper
async function findRepositoryById(repoId, userId) {
  const result = await db.query(
    'SELECT * FROM repositories WHERE "repoId" = $1 AND "userId" = $2',
    [repoId, userId]
  );
  return result.rows[0];
}

/**
 * Get recent commits for a repository
 * @route GET /api/github/repositories/:repoId/commits
 */
export const getRecentCommits = async (req, res) => {
  console.log("getRecentCommits req.url:", req.url, "req.params:", req.params);
  const { repoId } = req.params;
  try {
    // Use the helper, not the route handler
    const repo = await findRepositoryById(repoId, req.user.userId);
    if (!repo) {
      return res.status(404).json({ message: "Repository not found" });
    }
    // Get user's GitHub token
    const user = await getUserWithGithubToken(req.user.userId);
    if (!user?.githubAccessToken) {
      return res.status(401).json({ message: "GitHub access token not found" });
    }
    // Fetch commits
    const commits = await getRepoCommits(
      repo.ownerLogin,
      repo.repoName,
      user.githubAccessToken,
      20
    );
    res.json(commits);
  } catch (error) {
    console.error("Error fetching commits for repoId", repoId, ":", error);
    res
      .status(500)
      .json({ message: "Failed to fetch commits", error: error.message });
  }
};
