import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import yauzl from "yauzl-promise";
import mime from "mime-types";
import db from "../db/db.js";

// IMPORTANT: You need to replace <ACCOUNT_ID> with your actual Cloudflare account ID.
const s3Client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(filePath, r2Key) {
  const fileContent = await fs.readFile(filePath);
  const contentType = mime.lookup(r2Key) || "application/octet-stream";

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileContent,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(`Successfully uploaded ${r2Key} to R2.`);
  } catch (error) {
    console.error(`Failed to upload ${r2Key} to R2:`, error);
    throw error;
  }
}

// Function to set KV mapping in Cloudflare (Global API Key and Email only)
async function setKVMapping(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/storage/kv/namespaces/${process.env.KV_NAMESPACE_ID}/values/${key}`;
  if (!(process.env.CF_EMAIL && process.env.CF_API_KEY)) {
    throw new Error(
      "No Cloudflare Global API credentials found. Set CF_EMAIL and CF_API_KEY."
    );
  }
  const headers = {
    "Content-Type": "text/plain",
    "X-Auth-Email": process.env.CF_EMAIL,
    "X-Auth-Key": process.env.CF_API_KEY,
  };
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: value,
  });
  if (!response.ok) {
    throw new Error(`Failed to set KV: ${await response.text()}`);
  }
}

export const uploadProject = async (req, res) => {
  console.log("Upload request received");
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  console.log("req.file", req.file);
  console.log("req.body", req.body);
  console.log("req.params", req.params);
  const repoId = req.body.repoId || req.params.repo_id;

  const zipFilePath = req.file.path;
  const { projectSlug, userEmail, githubId, ownerLogin, repoName } = req.body;
  console.log(
    `Upload request for project: ${projectSlug}, userEmail: ${userEmail}, githubId: ${githubId}`
  );

  if (!projectSlug || !ownerLogin || !repoName) {
    await fs.rm(zipFilePath, { force: true });
    return res.status(400).json({
      message:
        "projectSlug, ownerLogin, or repoName not provided in form data.",
    });
  }

  // Respond immediately
  res.status(200).json({ message: "File received, processing in background." });

  // Process the upload in the background
  processUpload({
    req,
    zipFilePath,
    projectSlug,
    userEmail,
    githubId,
    ownerLogin,
    repoName,
    repoId,
  }).catch((error) => {
    console.error("Error in background upload processing:", error);
    // Optionally: notify user/admin or log to external service
  });
};

async function processUpload({
  req,
  zipFilePath,
  projectSlug,
  userEmail,
  githubId,
  ownerLogin,
  repoName,
  repoId,
}) {
  const extractPath = path.join("uploads", projectSlug);
  const r2PathPrefix = path.join(ownerLogin, repoName);
  try {
    await fs.mkdir(extractPath, { recursive: true });

    const zip = await yauzl.open(zipFilePath);
    try {
      for await (const entry of zip) {
        const entryPath = path.join(extractPath, entry.filename);
        if (entry.filename.endsWith("/")) {
          await fs.mkdir(entryPath, { recursive: true });
        } else {
          await fs.mkdir(path.dirname(entryPath), { recursive: true });
          const readStream = await entry.openReadStream();
          const writeStream = createWriteStream(entryPath);
          await new Promise((resolve, reject) => {
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
            readStream.pipe(writeStream);
          });
        }
      }
    } finally {
      await zip.close();
    }

    const distDirPath = path.join(extractPath, "dist");

    const uploadDir = async (dirPath, distRoot) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const localPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await uploadDir(localPath, distRoot);
        } else {
          const relPath = path
            .relative(distRoot, localPath)
            .replace(/\\/g, "/");
          const r2Key = `${ownerLogin}/${repoName}/${relPath}`;
          await uploadToR2(localPath, r2Key);
        }
      }
    };

    await uploadDir(distDirPath, distDirPath);

    // Add subdomain-to-path mapping in KV
    const subdomain = `${ownerLogin}-${repoName}`;
    const r2Prefix = `${ownerLogin}/${repoName}`;
    await setKVMapping(subdomain.toLowerCase(), r2Prefix);

    // Update the deployment status in the database
    console.log("Updating deployment status in the database");
    await db.query(
      `UPDATE repositories SET "deployStatus" = 'deployed'
      WHERE "repoName" = $1 AND "ownerLogin" = $2`,
      [repoName, ownerLogin]
    );

    // Fetch repo and workflow info for deployments update
    const repoResult = await db.query(
      'SELECT * FROM repositories WHERE "repoName" = $1 AND "ownerLogin" = $2',
      [repoName, ownerLogin]
    );
    const repo = repoResult.rows[0];
    if (!repo) throw new Error("Repository not found for deployments update");
    const userResult = await db.query(
      'SELECT "githubAccessToken" FROM users WHERE id = $1',
      [req.user.userId]
    );
    const user = userResult.rows[0];
    if (!user || !user.githubAccessToken)
      throw new Error("GitHub access token not found for deployments update");
    const githubAccessToken = user.githubAccessToken;
    const workflowId = repo.deployYmlWorkflowId;

    // Poll for final workflow run result
    async function waitForFinalWorkflowRun(
      ownerLogin,
      repoName,
      workflowId,
      githubAccessToken
    ) {
      const url = `https://api.github.com/repos/${ownerLogin}/${repoName}/actions/workflows/${workflowId}/runs?per_page=1`;
      let run;
      for (let i = 0; i < 20; i++) {
        // Try for up to ~100 seconds
        const response = await fetch(url, {
          headers: {
            authorization: `Bearer ${githubAccessToken}`,
            accept: "application/vnd.github.v3+json",
          },
        });
        const data = await response.json();
        run = data.workflow_runs && data.workflow_runs[0];
        if (run && run.status === "completed") break;
        await new Promise((res) => setTimeout(res, 5000)); // Wait 5 seconds
      }
      return run;
    }

    const finalRun = await waitForFinalWorkflowRun(
      ownerLogin,
      repoName,
      workflowId,
      githubAccessToken
    );
    if (finalRun && finalRun.status === "completed") {
      await db.query(
        `INSERT INTO deployments ("repoId", "workflowRunId", status, conclusion, "startedAt", "completedAt", "htmlUrl", "projectUrl")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("repoId") DO UPDATE SET
           "workflowRunId" = EXCLUDED."workflowRunId",
           status = EXCLUDED.status,
           conclusion = EXCLUDED.conclusion,
           "startedAt" = EXCLUDED."startedAt",
           "completedAt" = EXCLUDED."completedAt",
           "htmlUrl" = EXCLUDED."htmlUrl"`,
        [
          repo.repoId,
          finalRun.id,
          finalRun.status,
          finalRun.conclusion,
          finalRun.created_at,
          finalRun.updated_at,
          finalRun.html_url,
          `https://${subdomain}.frontbase.space`,
        ]
      );
    }
  } catch (error) {
    console.error("Error deploying project (background):", error);
  } finally {
    // Clean up temporary files
    await fs
      .rm(zipFilePath, { recursive: true, force: true })
      .catch((err) => console.error("Failed to remove zip file:", err));
    await fs
      .rm(extractPath, { recursive: true, force: true })
      .catch((err) => console.error("Failed to remove extract path:", err));
  }
}
