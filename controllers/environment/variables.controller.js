import db from "../../db/db.js";

export const getEnvironmentVariables = async (req, res) => {
  const { repoId } = req.params;
  try {
    const envsResult = await db.query(
      `SELECT key, value FROM repo_env_vars WHERE "repoId" = $1`,
      [repoId]
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

export const addEnvironmentVariable = async (req, res) => {
  const { userId } = req.user;
  const { repoId } = req.params;
  const { key, value } = req.body;
  if (!key || key.trim() === "") {
    return res.status(400).json({ message: "Key is required." });
  }
  try {
    await db.query(
      'INSERT INTO repo_env_vars ("userId", "repoId", "key", "value") VALUES ($1, $2, $3, $4) ON CONFLICT ("repoId", "key") DO UPDATE SET "value" = EXCLUDED."value", "userId" = EXCLUDED."userId"',
      [userId, repoId, key, value]
    );
    res.status(200).json({ message: "Environment variable added/updated." });
  } catch (error) {
    console.error("Failed to add env:", error);
    res.status(500).json({ message: "Failed to add environment variable." });
  }
};

export const deleteEnvironmentVariable = async (req, res) => {
  const { userId } = req.user;
  const { repoId } = req.params;
  const { key } = req.body;
  if (!key || key.trim() === "") {
    return res.status(400).json({ message: "Key is required." });
  }
  try {
    await db.query(
      'DELETE FROM repo_env_vars WHERE "userId" = $1 AND "repoId" = $2 AND "key" = $3',
      [userId, repoId, key]
    );
    res.status(200).json({ message: "Environment variable deleted." });
  } catch (error) {
    console.error("Failed to delete env:", error);
    res.status(500).json({ message: "Failed to delete environment variable." });
  }
};
