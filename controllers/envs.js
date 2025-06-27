import db from "../db/db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export const getEnvs = async (req, res) => {
  // Accept JWT in Authorization header or as a POST body param
  console.log("getEnvs");
  const authHeader = req.headers.authorization;
  console.log("authHeader", authHeader);
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.body?.token;
  console.log("token", token);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Missing token." });
  }
  console.log("token", token);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: "Forbidden: Invalid token." });
  }
  console.log("payload", payload);
  // Extract repo info from JWT
  const { repoId } = payload;
  if (!repoId) {
    return res.status(400).json({ message: "Invalid token payload." });
  }
  console.log("repoId", repoId);
  try {
    const envsResult = await db.query(
      `SELECT key, value FROM repo_env_vars WHERE "repoId" = $1`,
      [repoId]
    );
    console.log("envsResult", envsResult);
    const envs = envsResult.rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    console.log("envs", envs);
    res.json(envs);
  } catch (error) {
    console.error("Failed to fetch envs:", error);
    res.status(500).json({ message: "Failed to fetch environment variables." });
  }
};
