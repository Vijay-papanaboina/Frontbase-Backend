import db from "../../db/db.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { injectRepoSecret } from "./secrets.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const setupRepo = async (req, res) => {
  const repoId = req.params.repo_id;
  const {
    repoName,
    ownerLogin,
    envVars,
    framework,
    buildCommand,
    outputFolder,
  } = req.body || {};
  if (!repoName || !ownerLogin) {
    return res
      .status(400)
      .json({ message: "Missing repoName or ownerLogin in request body." });
  }

  try {
    // Get user's GitHub access token from the database
    const userResult = await db.query(
      'SELECT "githubAccessToken", "githubId", email, id FROM users WHERE id = $1',
      [req.user.userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.githubAccessToken) {
      return res
        .status(401)
        .json({ message: "GitHub access token not found." });
    }

    const userEmail = user.email;
    const githubId = user.githubId;
    const userId = user.id;

    if (!userEmail || !githubId) {
      return res
        .status(400)
        .json({ message: "User email or githubId not found." });
    }

    // --- 1. CREATE REPO RECORD (OR IGNORE IF EXISTS) ---
    // Create the repo record first with a 'pending' status.
    // This prevents foreign key violations and misleading UI states.
    await db.query(
      `INSERT INTO repositories ("repoId", "repoName", "ownerLogin", "userId", "deployYmlInjected", "deployStatus")
       VALUES ($1, $2, $3, $4, FALSE, 'pending')
       ON CONFLICT ("repoId") DO NOTHING`,
      [repoId, repoName, ownerLogin, userId]
    );

    // Fetch repository details from GitHub API
    console.log(`Checking repository: ${ownerLogin}/${repoName}`);
    const urlWithParams5 = new URL(
      `https://api.github.com/repos/${ownerLogin}/${repoName}`
    );
    const response5 = await fetch(urlWithParams5, {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    });

    if (!response5.ok) {
      const errorData = await response5.json();
      throw new Error(
        `Repository not found or no access: ${errorData.message}`
      );
    }

    const repoData = await response5.json();

    // Check token scopes
    const scopeHeaders = response5.headers.get("x-oauth-scopes");

    // Verify we can write to the repository
    if (!repoData.permissions || !repoData.permissions.push) {
      throw new Error(`No push permission to repository ${repoData.full_name}`);
    }

    // --- SECRET INJECTION ---

    const repoJwt = jwt.sign({ repoId: repoId, userId: userId }, JWT_SECRET, {
      expiresIn: "1y", // Consider implementing token refresh mechanism
    });
    await injectRepoSecret(
      ownerLogin,
      repoName,
      "ENV_ACCESS_TOKEN",
      repoJwt,
      user.githubAccessToken
    );

    // --- ENV VARS HANDLING ---
    if (Array.isArray(envVars)) {
      // Remove existing env vars for this user/repo
      await db.query(
        'DELETE FROM repo_env_vars WHERE "userId" = $1 AND "repoId" = $2',
        [userId, repoId]
      );
      // Insert new env vars
      for (const env of envVars) {
        if (env.key && env.key.trim() !== "") {
          await db.query(
            'INSERT INTO repo_env_vars ("userId", "repoId", "key", "value") VALUES ($1, $2, $3, $4)',
            [userId, repoId, env.key, env.value]
          );
        }
      }
    }

    // Read workflow template
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const workflowTemplatePath = path.join(
      __dirname,
      "..",
      "..",
      "workflows",
      "deploy.yml"
    );
    let deployYamlContent = await fs.readFile(workflowTemplatePath, "utf-8");

    // Replace placeholders
    deployYamlContent = deployYamlContent
      .replace(/{{BACKEND_URL}}/g, process.env.BACKEND_URL)
      .replace(/{{PROJECT_SLUG}}/g, `${ownerLogin}-${repoName}`)
      .replace(/{{OWNER_LOGIN}}/g, ownerLogin)
      .replace(/{{REPO_NAME}}/g, repoName)
      .replace(/{{USER_EMAIL}}/g, userEmail)
      .replace(/{{GITHUB_ID}}/g, githubId)
      .replace(/{{REPO_ID}}/g, repoId);

    // Inject build command and output folder
    const buildCmd = buildCommand || "npm run build";
    const outFolder = outputFolder || "dist";
    deployYamlContent = deployYamlContent
      .replace(/{{BUILD_COMMAND}}/g, buildCmd)
      .replace(/{{BUILD_DIR}}/g, outFolder);

    const encodedContent = Buffer.from(deployYamlContent).toString("base64");

    // Check if workflow file already exists
    let existingFileSha = null;
    const workflowPath = `.github/workflows/deploy.yml`;

    const urlWithParams6 = new URL(
      `https://api.github.com/repos/${ownerLogin}/${repoName}/contents/${workflowPath}`
    );
    const response6 = await fetch(urlWithParams6, {
      method: "GET",
      headers: {
        authorization: `Bearer ${user.githubAccessToken}`,
        accept: "application/vnd.github.v3+json",
      },
    });

    if (response6.ok) {
      const data = await response6.json();
      existingFileSha = data.sha;
    } else if (response6.status !== 404) {
      const errorData = await response6.json();
      throw new Error(`GitHub API error: ${errorData.message}`);
    } else {
      console.log(`Workflow file doesn't exist (404), will create new one`);
    }

    if (existingFileSha) {
      // Update file
      const urlWithParams7 = new URL(
        `https://api.github.com/repos/${ownerLogin}/${repoName}/contents/${workflowPath}`
      );
      const response7 = await fetch(urlWithParams7, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${user.githubAccessToken}`,
          accept: "application/vnd.github.v3+json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "Update deploy.yml workflow",
          content: encodedContent,
          sha: existingFileSha,
        }),
      });

      if (!response7.ok) {
        const errorData = await response7.json();
        throw new Error(`Failed to update deploy.yml: ${errorData.message}`);
      }

      const data = await response7.json();
    } else {
      // Create file in two steps: 1. placeholder for folder, 2. actual file
      const placeholderPath = ".github/workflows/.gitkeep";
      const placeholderContent = Buffer.from("").toString("base64"); // Empty file

      const placeholderUrl = new URL(
        `https://api.github.com/repos/${ownerLogin}/${repoName}/contents/${placeholderPath}`
      );

      const placeholderResponse = await fetch(placeholderUrl, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${user.githubAccessToken}`,
          accept: "application/vnd.github.v3+json",
          "content-type": "application/json",
          "user-agent": "FrontBase-App",
        },
        body: JSON.stringify({
          message: "Create .github/workflows directory",
          content: placeholderContent,
        }),
      });

      // If it fails, but not because the file already exists (422), throw an error.
      // Otherwise, we can safely ignore the error and proceed.
      if (!placeholderResponse.ok && placeholderResponse.status !== 422) {
        const errorData = await placeholderResponse.json();
        if (!errorData.message.includes("sha")) {
          // Ignore "sha" error which means file exists
          throw new Error(
            `Failed to create placeholder file for directory structure: ${errorData.message}`
          );
        }
      }

      const urlWithParams8 = new URL(
        `https://api.github.com/repos/${ownerLogin}/${repoName}/contents/${workflowPath}`
      );

      const requestBody = {
        message: "Add deploy.yml workflow",
        content: encodedContent,
        branch: "main", // Explicitly specify the branch
      };

      const response8 = await fetch(urlWithParams8, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${user.githubAccessToken}`,
          accept: "application/vnd.github.v3+json",
          "content-type": "application/json",
          "user-agent": "FrontBase-App",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response8.ok) {
        const errorData = await response8.json();

        // If still failing, try without specifying branch
        const fallbackBody = {
          message: "Add deploy.yml workflow",
          content: encodedContent,
        };

        const fallbackResponse = await fetch(urlWithParams8, {
          method: "PUT",
          headers: {
            authorization: `Bearer ${user.githubAccessToken}`,
            accept: "application/vnd.github.v3+json",
            "content-type": "application/json",
            "user-agent": "FrontBase-App",
          },
          body: JSON.stringify(fallbackBody),
        });

        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.json();
          throw new Error(
            `Failed to create deploy.yml: ${
              errorData.message || "Unknown error"
            }`
          );
        }

        const fallbackData = await fallbackResponse.json();
      } else {
        const data = await response8.json();
      }
    }

    // --- Get the workflow ID and save it ---
    // It can take a few seconds for the workflow to be recognized by GitHub.
    // We'll retry a few times.
    let workflowId = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!workflowId && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 3000)); // wait 3 seconds

      const workflowsResponse = await fetch(
        `https://api.github.com/repos/${ownerLogin}/${repoName}/actions/workflows`,
        {
          headers: {
            authorization: `Bearer ${user.githubAccessToken}`,
            accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (workflowsResponse.ok) {
        const workflowsData = await workflowsResponse.json();
        const targetWorkflow = workflowsData.workflows.find(
          (wf) => wf.path === ".github/workflows/deploy.yml"
        );
        if (targetWorkflow) {
          workflowId = targetWorkflow.id;
        }
      }
    }

    if (!workflowId) {
      throw new Error("Could not find the workflow ID after several attempts.");
    }

    // --- DATABASE UPDATE ---
    // This is the final step, only run after all GitHub operations are successful.
    await db.query(
      `UPDATE repositories SET "deployYmlInjected" = TRUE, "deployYmlWorkflowId" = $1 
      WHERE "repoId" = $2`,
      [workflowId, repoId]
    );

    res.status(200).json({ message: "Deploy workflow setup complete." });
  } catch (error) {
    console.error("Error setting up deploy workflow:", error);
    res.status(500).json({
      message: "Failed to set up deploy workflow",
      error: error.message,
    });
  }
};
