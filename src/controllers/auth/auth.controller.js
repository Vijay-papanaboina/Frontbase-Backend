import jwt from "jsonwebtoken";
import { env } from "../../config/environment.js";
import { userRepository } from "../../repositories/user.repository.js";
import {
  getGithubUser,
  getGithubToken,
} from "../../services/github.service.js";
import { GITHUB_SCOPES, JWT_CONFIG } from "../../utils/constants.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";

/**
 * Initiate GitHub OAuth flow
 */
export const githubLogin = (req, res) => {
  const redirectUrl = `${
    process.env.GITHUB_OAUTH_URL || "https://github.com/login/oauth/authorize"
  }?client_id=${env.GITHUB_OAUTH_CLIENT_ID}&scope=${GITHUB_SCOPES}`;
  res.redirect(redirectUrl);
};

/**
 * Handle GitHub OAuth callback
 */
export const githubCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "No code provided." });
  }

  // Exchange code for access token
  const { access_token } = await getGithubToken(code);
  if (!access_token) {
    throw new Error("Failed to get access token from GitHub");
  }

  // Get user data from GitHub
  const { user: githubUser, primaryEmail } = await getGithubUser(access_token);

  // Create or update user in database
  const user = await createOrUpdateUser(githubUser, primaryEmail, access_token);

  // Generate JWT
  const token = generateAuthToken(user);

  // Set cookie and redirect
  setAuthCookie(res, token);
  res.redirect(`${env.FRONTEND_URL}/dashboard`);
});

/**
 * Get current user details
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await userRepository.getUserDetails(req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  res.json({ user });
});

/**
 * Log out user
 */
export const logout = (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logged out successfully." });
};

// Helper functions

/**
 * Create or update user in database
 */
async function createOrUpdateUser(githubUser, email, accessToken) {
  const {
    id: githubId,
    name: userName,
    login: githubHandle,
    avatar_url: avatarUrl,
    html_url: htmlUrl,
  } = githubUser;

  let user = await userRepository.findByGithubId(githubId);

  if (user) {
    // Update existing user's access token
    user = await userRepository.updateAccessToken(user.id, accessToken);
  } else {
    // Create new user
    user = await userRepository.create({
      githubId,
      userName,
      githubHandle,
      avatarUrl,
      htmlUrl,
      githubAccessToken: accessToken,
      email,
    });
  }

  return user;
}

/**
 * Generate JWT auth token
 */
function generateAuthToken(user) {
  return jwt.sign(
    { userId: user.id, githubId: user.githubId },
    env.JWT_SECRET,
    { expiresIn: JWT_CONFIG.EXPIRES_IN }
  );
}

/**
 * Set authentication cookie
 */
function setAuthCookie(res, token) {
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Clear authentication cookie
 */
function clearAuthCookie(res) {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  });
}
