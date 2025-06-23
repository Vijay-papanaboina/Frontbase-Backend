import jwt from "jsonwebtoken";
import db from "../db/db.js";

const GITHUB_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

export const githubLogin = (req, res) => {
  console.log("[BACKEND] /api/auth/github called");
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email repo workflow`;
  res.redirect(redirectUrl);
};

export const githubCallback = async (req, res) => {
  const { code } = req.query;
  console.log(code);

  if (!code) {
    return res.status(400).json({ error: "No code provided." });
  }

  try {
    // 1. Exchange code for access token

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: code,
          redirect_uri: `${process.env.BACKEND_URL}/api/auth/github/callback`,
        }),
      }
    );
    console.log("tokenResponse", tokenResponse);
    const data = await tokenResponse.json();
    console.log("data", data);
    const { access_token } = data;

    if (!access_token) {
      console.error("Failed to get access token from GitHub");
      return res
        .status(500)
        .json({ error: "Failed to authenticate with GitHub." });
    }

    console.log(access_token);

    // 2. Fetch user profile from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        authorization: `token ${access_token}`,
      },
    });

    const userData = await userResponse.json();
    console.log("userData", userData);

    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        authorization: `token ${access_token}`,
      },
    });
    const emailsData = await emailResponse.json();
    const primaryEmail = emailsData.find((email) => email.primary)?.email;

    const {
      id: githubId,
      name: user_name,
      avatar_url,
      html_url,
      login: github_handle,
    } = userData;

    // 3. Create or update user in our database
    let userResult = await db.query(
      'SELECT * FROM users WHERE "githubId" = $1',
      [githubId]
    );
    let user = userResult.rows[0];

    if (!user) {
      // User doesn't exist, create new one with access token
      // NOTE: This assumes 'email' column exists in 'users' table.
      // You might need to add it: ALTER TABLE users ADD COLUMN email VARCHAR(255);
      const newUserResult = await db.query(
        'INSERT INTO users ("githubId", "user_name", "github_handle", "avatarUrl", "htmlUrl", "githubAccessToken", email) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          githubId,
          user_name,
          github_handle,
          avatar_url,
          html_url,
          access_token,
          primaryEmail,
        ]
      );
      user = newUserResult.rows[0];
      console.log(`New user created: ${user_name} (${github_handle})`);
    } else {
      // User exists, update access token and email
      // NOTE: This assumes 'email' column exists in 'users' table.
      await db.query(
        'UPDATE users SET "githubAccessToken" = $1 WHERE id = $2',
        [access_token, user.id]
      );
      console.log(
        `User logged in and token updated: ${user_name} (${github_handle})`
      );
    }

    // 4. Generate JWT
    const jwtToken = jwt.sign(
      { userId: user.id, githubId: user.githubId },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    console.log("About to set cookie for JWT");
    res.cookie("jwt", jwtToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    console.log(
      "Set-Cookie header about to be sent:",
      res.getHeaders()["set-cookie"]
    );

    // Instead of redirecting, just send a JSON response
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.log(error);
    const detailedError = error.response
      ? error.response.data
      : { message: error.message };
    console.error("GitHub auth callback error:", detailedError);
    // Send detailed error for easier debugging in development
    res.status(500).json({
      error: "An error occurred during authentication.",
      // For debugging: This sends the actual error from GitHub back to the browser
      details: detailedError,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, "githubId", "user_name", "github_handle", "avatarUrl", "htmlUrl" FROM users WHERE id = $1',
      [req.user.userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ user });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ message: "Failed to fetch user information." });
  }
};

export const logout = (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 0,
  });
  res.status(200).json({ message: "Logged out successfully." });
};
