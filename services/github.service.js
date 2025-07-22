import sodium from "libsodium-wrappers";

/**
 * Inject a secret into a GitHub repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} secretName - Name of the secret
 * @param {string} secretValue - Value of the secret
 * @param {string} githubToken - GitHub access token
 */
export async function injectRepoSecret(
  owner,
  repo,
  secretName,
  secretValue,
  githubToken
) {
  await sodium.ready;

  // Get repository public key
  const keyResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!keyResponse.ok) {
    throw new Error(`Failed to get public key for ${owner}/${repo}`);
  }

  const { key_id, key } = await keyResponse.json();

  // Encrypt the secret
  const publicKeyBytes = sodium.from_base64(
    key,
    sodium.base64_variants.ORIGINAL
  );
  const secretBytes = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes);
  const encryptedValue = sodium.to_base64(
    encryptedBytes,
    sodium.base64_variants.ORIGINAL
  );

  // Upload the encrypted secret
  const secretResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: key_id,
      }),
    }
  );

  if (!secretResponse.ok) {
    throw new Error(`Failed to set secret on ${owner}/${repo}`);
  }
}

/**
 * Get GitHub API headers with authentication
 * @param {string} token - GitHub access token
 * @returns {Object} Headers object
 */
export function getGithubHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github.v3+json",
    "content-type": "application/json",
  };
}

/**
 * Make an authenticated request to the GitHub API
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @param {string} token - GitHub access token
 * @returns {Promise<Object>} Response data
 */
export async function githubRequest(url, options, token) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getGithubHeaders(token),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "GitHub API request failed");
  }

  return response.json();
}

/**
 * Get GitHub access token from authorization code
 * @param {string} code - GitHub authorization code
 * @returns {Promise<Object>} Access token response
 */
export async function getGithubToken(code) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.BACKEND_URL}/api/auth/github/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get GitHub access token");
  }

  return response.json();
}

/**
 * Get GitHub user data and primary email
 * @param {string} token - GitHub access token
 * @returns {Promise<Object>} User data and primary email
 */
export async function getGithubUser(token) {
  const [userResponse, emailResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: { authorization: `token ${token}` },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: { authorization: `token ${token}` },
    }),
  ]);

  if (!userResponse.ok || !emailResponse.ok) {
    throw new Error("Failed to fetch GitHub user data");
  }

  const [userData, emailsData] = await Promise.all([
    userResponse.json(),
    emailResponse.json(),
  ]);

  return {
    user: userData,
    primaryEmail: emailsData.find((email) => email.primary)?.email,
  };
}

/**
 * Fetch commit history for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} token - GitHub access token
 * @param {number} [perPage=20] - Number of commits to fetch
 * @returns {Promise<Array>} List of commits
 */
export async function getRepoCommits(owner, repo, token, perPage = 20) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`;
  return githubRequest(url, {}, token);
}
