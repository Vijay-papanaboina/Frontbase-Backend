import { userRepository } from "../../repositories/user.repository.js";
import { repositoryRepository } from "../../repositories/repository.repository.js";
import { getRepoCommits } from "../../services/github.service.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";

/**
 * Get all repositories for the authenticated user
 */
export const getRepositories = asyncHandler(async (req, res) => {
  // Get user's GitHub access token
  const user = await userRepository.getUserWithToken(req.user.userId);
  if (!user?.githubAccessToken) {
    return res.status(401).json({ message: "GitHub access token not found." });
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
  const dbRepos = await repositoryRepository.findByUser(req.user.userId);

  // Create lookup maps for status
  const statusMap = dbRepos.reduce(
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
});

/**
 * Get a single repository by ID
 */
export const getRepositoryById = asyncHandler(async (req, res) => {
  const { repoId } = req.params;

  const repo = await repositoryRepository.findByIdAndUser(
    repoId,
    req.user.userId
  );
  if (!repo) {
    return res.status(404).json({ message: "Repository not found." });
  }

  res.json(repo);
});

/**
 * Get recent commits for a repository
 */
export const getRecentCommits = asyncHandler(async (req, res) => {
  const { repoId } = req.params;

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

  // Fetch commits
  const commits = await getRepoCommits(
    repo.ownerLogin,
    repo.repoName,
    user.githubAccessToken,
    20
  );

  res.json(commits);
});
