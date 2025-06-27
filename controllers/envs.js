import db from "../db/db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export const getEnvs = async (req, res) => {
  // Accept JWT in Authorization header or as a POST body param
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.body?.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Missing token." });
  }
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: "Forbidden: Invalid token." });
  }
  // Extract repo info from JWT
  const { repoId } = payload;
  if (!repoId) {
    return res.status(400).json({ message: "Invalid token payload." });
  }
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
