import { App } from "@octokit/app";
import db from "./db/db.js";
import { Octokit } from "@octokit/core";
import sodium from "tweetsodium";

const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  },
});

// Helper function to get installation Octokit client with token caching
async function getInstallationOctokit(installationId) {
  // Check if a valid token exists in the database
  const installation = db
    .prepare(
      "SELECT accessToken, tokenExpiresAt FROM installations WHERE installationId = ?"
    )
    .get(installationId);

  if (
    installation &&
    installation.accessToken &&
    new Date(installation.tokenExpiresAt) > new Date()
  ) {
    console.log(`Using cached token for installation ${installationId}`);
    return new Octokit({ auth: installation.accessToken });
  }

  // If no valid token, fetch a new one and store it
  const octokit = await app.getInstallationOctokit(installationId);
  const { token, expires_at } =
    await octokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

  db.prepare(
    "UPDATE installations SET accessToken = ?, tokenExpiresAt = ? WHERE installationId = ?"
  ).run(token, expires_at, installationId);

  console.log(
    `Fetched and cached new token for installation ${installationId}`
  );
  return octokit;
}

// Event listener for when the app is installed
app.webhooks.on("installation.created", async ({ payload }) => {
  const { id, account, repositories_url, html_url } = payload.installation;
  console.log(`New installation created: ${account.login}`);
  try {
    await db.query(
      'INSERT INTO installations ("installationId", "userId", "accountLogin", "accountType", "repositoriesUrl", "htmlUrl") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ("installationId") DO NOTHING',
      [id, account.id, account.login, account.type, repositories_url, html_url]
    );
  } catch (error) {
    console.error("Failed to save new installation:", error);
  }
});

// Event listener for when the app is uninstalled
app.webhooks.on("installation.deleted", async ({ payload }) => {
  const { id } = payload.installation;
  console.log(`Installation deleted: ${id}`);
  try {
    await db.query('DELETE FROM installations WHERE "installationId" = $1', [
      id,
    ]);
    await db.query('DELETE FROM repositories WHERE "installationId" = $1', [
      id,
    ]);
  } catch (error) {
    console.error("Failed to delete installation:", error);
  }
});

// Event listener for when new repositories are added to an installation
app.webhooks.on("installation_repositories.added", async ({ payload }) => {
  const { installation, repositories_added } = payload;
  console.log(
    `Repositories added to installation ${installation.id}:`,
    repositories_added.map((r) => r.full_name)
  );
  try {
    for (const repo of repositories_added) {
      await db.query(
        'INSERT INTO repositories ("repoId", "installationId", "ownerLogin", "repoName", "fullName", "defaultBranch", "cloneUrl", "htmlUrl") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT ("repoId") DO NOTHING',
        [
          repo.id,
          installation.id,
          repo.owner.login,
          repo.name,
          repo.full_name,
          repo.default_branch,
          repo.clone_url,
          repo.html_url,
        ]
      );
    }
  } catch (error) {
    console.error("Failed to add repositories:", error);
  }
});

// Event listener for when repositories are removed from an installation
app.webhooks.on("installation_repositories.removed", async ({ payload }) => {
  const { installation, repositories_removed } = payload;
  console.log(
    `Repositories removed from installation ${installation.id}:`,
    repositories_removed.map((r) => r.full_name)
  );
  try {
    const repoIds = repositories_removed.map((r) => r.id);
    await db.query('DELETE FROM repositories WHERE "repoId" = ANY($1::int[])', [
      repoIds,
    ]);
  } catch (error) {
    console.error("Failed to remove repositories:", error);
  }
});

// Handle successful workflow runs
app.webhooks.on("workflow_run.completed", async ({ payload }) => {
  const { workflow_run } = payload;
  const {
    id: runId,
    conclusion,
    repository,
    head_branch,
    head_sha,
    html_url,
  } = workflow_run;

  if (conclusion === "success") {
    console.log(
      `Workflow Run Completed Successfully: ${repository.full_name} - Branch: ${head_branch} - SHA: ${head_sha}`
    );
    console.log(`View run: ${html_url}`);
    // In a more advanced scenario, you might update a 'deployments' table here
    // or trigger further actions based on the successful build.

    // Example: update the repository's last deploy time (requires new column in repositories table)
    // db.prepare("UPDATE repositories SET lastDeployedAt = CURRENT_TIMESTAMP WHERE fullName = ?").run(repository.full_name);
  } else {
    console.log(
      `Workflow Run Completed with status: ${conclusion} for ${repository.full_name}`
    );
  }
});

// Error handling for webhooks
app.webhooks.onError(({ error }) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing webhook: ${error.event.name}`);
  } else {
    console.error(error);
  }
});

export const getOctokit = async (githubUserId) => {
  // Find the installation associated with the user's GitHub ID
  const installationResult = await db.query(
    'SELECT "installationId" FROM installations WHERE "userId" = $1',
    [githubUserId]
  );
  const installation = installationResult.rows[0];

  if (!installation) {
    throw new Error(`No installation found for GitHub user ID ${githubUserId}`);
  }

  return getInstallationOctokit(installation.installationId);
};

export default app;

async function injectSecret(owner, repo, secretName, secretValue) {
  // 1. Get the public key for the repo
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

Security concern: Avoid hardcoded authentication tokens.

Using process.env.GITHUB_TOKEN bypasses the existing i  const { data: publicKey } = await octokit.actions.getRepoPublicKey({
    owner,
    repo,
  });

  // 2. Encrypt the secret value
  const key = Buffer.from(publicKey.key, "base64");
  const value = Buffer.from(secretValue);
  const encryptedBytes = sodium.seal(value, key);
  const encryptedValue = Buffer.from(encryptedBytes).toString("base64");

  // 3. Create or update the secret
  await octokit.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: publicKey.key_id,
  });
}

// Usage
injectSecret("OWNER", "REPO", "mysecret", "your_secret_value_here")
  .then(() => console.log("Secret injected!"))
  .catch(console.error);
