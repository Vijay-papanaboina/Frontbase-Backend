import jwt from "jsonwebtoken";
import db from "../../db/db.js";
import {
  getGithubUser,
  getGithubToken,
} from "../../services/github.service.js";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Initiate GitHub OAuth flow
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const githubLogin = (req, res) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_OAUTH_CLIENT_ID}&scope=user:email repo workflow`;
  res.redirect(redirectUrl);
};

/**
 * Handle GitHub OAuth callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const githubCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "No code provided." });
  }

  try {
    // Exchange code for access token
    const { access_token } = await getGithubToken(code);
    if (!access_token) {
      throw new Error("Failed to get access token from GitHub");
    }

    // Get user data from GitHub
    const { user: githubUser, primaryEmail } = await getGithubUser(
      access_token
    );

    // Create or update user in database
    const user = await createOrUpdateUser(
      githubUser,
      primaryEmail,
      access_token
    );

    // Generate JWT
    const token = generateAuthToken(user);

    // Set cookie and redirect
    setAuthCookie(res, token);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("GitHub auth callback error:", error);
    res.status(500).json({
      error: "Authentication failed",
      details: error.message,
    });
  }
};

/**
 * Get current user details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMe = async (req, res) => {
  try {
    const user = await getUserDetails(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ user });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ message: "Failed to fetch user information." });
  }
};

/**
 * Log out user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const logout = (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logged out successfully." });
};

// Helper functions

/**
 * Create or update user in database
 * @param {Object} githubUser - GitHub user data
 * @param {string} email - User's email
 * @param {string} accessToken - GitHub access token
 * @returns {Promise<Object>} User object
 */
async function createOrUpdateUser(githubUser, email, accessToken) {
  const {
    id: githubId,
    name: userName,
    login: githubHandle,
    avatar_url: avatarUrl,
    html_url: htmlUrl,
  } = githubUser;

  let user = await findUserByGithubId(githubId);

  if (user) {
    // Update existing user
    await db.query('UPDATE users SET "githubAccessToken" = $1 WHERE id = $2', [
      accessToken,
      user.id,
    ]);
  } else {
    // Create new user
    const result = await db.query(
      `INSERT INTO users (
        "githubId", "user_name", "github_handle",
        "avatarUrl", "htmlUrl", "githubAccessToken", email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [githubId, userName, githubHandle, avatarUrl, htmlUrl, accessToken, email]
    );
    user = result.rows[0];
  }

  return user;
}

/**
 * Find user by GitHub ID
 * @param {string} githubId - GitHub user ID
 * @returns {Promise<Object>} User object
 */
async function findUserByGithubId(githubId) {
  const result = await db.query('SELECT * FROM users WHERE "githubId" = $1', [
    githubId,
  ]);
  return result.rows[0];
}

/**
 * Get user details by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User details
 */
async function getUserDetails(userId) {
  const result = await db.query(
    `SELECT id, "githubId", "user_name", "github_handle",
            "avatarUrl", "htmlUrl"
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Generate JWT auth token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateAuthToken(user) {
  return jwt.sign({ userId: user.id, githubId: user.githubId }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

/**
 * Set authentication cookie
 * @param {Object} res - Express response object
 * @param {string} token - JWT token
 */
function setAuthCookie(res, token) {
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Clear authentication cookie
 * @param {Object} res - Express response object
 */
function clearAuthCookie(res) {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
}
