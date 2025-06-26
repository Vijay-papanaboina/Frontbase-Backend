import db from "../db/db.js";

// A more secure approach would be to use OIDC tokens from GitHub Actions.
// This is a simpler implementation using a shared secret.
const GITHUB_ACTIONS_SECRET = process.env.GITHUB_ACTIONS_SECRET;

export const getEnvs = async (req, res) => {
  // TODO: Re-enable authentication for production
  // const authHeader = req.headers.authorization;
  // if (!authHeader || !authHeader.startsWith("Bearer ")) {
  //   return res.status(401).json({ message: "Unauthorized: Missing token." });
  // }

  // const token = authHeader.split(" ")[1];
  // if (token !== GITHUB_ACTIONS_SECRET) {
  //   return res.status(403).json({ message: "Forbidden: Invalid token." });
  // }

  const { githubId, repoName } = req.params;

  try {
    const envsResult = await db.query(
      `SELECT v.key, v.value
       FROM repo_env_vars v
       JOIN repositories r ON v."repoId" = r."repoId"
       JOIN users u ON r."userId" = u.id
       WHERE u."githubId" = $1 AND r."repoName" = $2`,
      [githubId, repoName]
    );

    const envs = envsResult.rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    res.json(envs);
  } catch (error) {
    console.error("Failed to fetch envs:", error);
    res.status(500).json({ message: "Failed to fetch environment variables." });
  }
};
