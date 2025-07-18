import db from "../../db/db.js";

export const getRepos = async (req, res) => {
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

    // Fetch repositories using the user's stored access token
    const urlWithParams1 = new URL("https://api.github.com/user/repos");
    urlWithParams1.searchParams.append("sort", "updated");
    urlWithParams1.searchParams.append("per_page", "100");
    const response1 = await fetch(urlWithParams1, {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    });
    const data = await response1.json();

    // Fetch injected status and deployStatus for each repo from your DB
    const dbRepos = await db.query(
      'SELECT "repoId", "deployYmlInjected", "deployStatus" FROM repositories WHERE "userId" = $1',
      [req.user.userId]
    );
    const injectedMap = {};
    const statusMap = {};
    dbRepos.rows.forEach((r) => {
      injectedMap[r.repoId] = r.deployYmlInjected;
      statusMap[r.repoId] = r.deployStatus;
    });

    // Attach deployYmlInjected and deployStatus to each repo
    const reposWithStatus = data.map((repo) => ({
      ...repo,
      deployYmlInjected: injectedMap[repo.id] || false,
      deployStatus: statusMap[repo.id] || "not-deployed",
    }));

    res.json({ repos: reposWithStatus });
  } catch (error) {
    console.error("Failed to fetch repositories:", error);
    res.status(500).json({ message: "Failed to fetch repositories." });
  }
};
