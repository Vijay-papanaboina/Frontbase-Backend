import { uploadToR2, setKVMapping } from "../../services/storage.service.js";
import { processZipFile } from "../../services/upload.service.js";
import { updateDeploymentStatus } from "../../services/deployment.service.js";
import db from "../../db/db.js";
import fs from "fs/promises";
import path from "path";

/**
 * Handle project upload and deployment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const uploadProject = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const repoId = req.body.repoId || req.params.repo_id;
  const { projectSlug, userEmail, githubId, ownerLogin, repoName } = req.body;

  if (!projectSlug || !ownerLogin || !repoName) {
    return res.status(400).json({
      message: "Missing required fields: projectSlug, ownerLogin, or repoName",
    });
  }

  // Respond immediately as this will be a long-running operation
  res.status(200).json({ message: "File received, processing in background." });

  // Process the upload in the background
  processUpload({
    req,
    zipFilePath: req.file.path,
    projectSlug,
    userEmail,
    githubId,
    ownerLogin,
    repoName,
    repoId,
  }).catch((error) => {
    console.error("Error in background upload processing:", error);
  });
};

/**
 * Process the uploaded file and deploy the project
 * @param {Object} params - Upload parameters
 */
async function processUpload({
  req,
  zipFilePath,
  projectSlug,
  ownerLogin,
  repoName,
  repoId,
}) {
  try {
    // Extract and process the zip file
    const { extractPath, distPath } = await processZipFile(
      zipFilePath,
      projectSlug
    );

    // Upload files to R2
    await uploadFilesToR2(distPath, ownerLogin, repoName);

    // Set up KV mapping for the subdomain
    const subdomain = `${ownerLogin}-${repoName}`;
    await setKVMapping(subdomain.toLowerCase(), `${ownerLogin}/${repoName}`);

    // Update deployment status
    await updateDeploymentStatus({
      repoName,
      ownerLogin,
      repoId,
      userId: req.user.userId,
      subdomain,
    });
  } catch (error) {
    console.error("Error deploying project:", error);
    throw error;
  }
}

/**
 * Upload directory contents to R2
 * @param {string} dirPath - Path to directory
 * @param {string} ownerLogin - Repository owner
 * @param {string} repoName - Repository name
 */
async function uploadFilesToR2(dirPath, ownerLogin, repoName) {
  const uploadFile = async (filePath, relativePath) => {
    const r2Key = `${ownerLogin}/${repoName}/${relativePath}`;
    await uploadToR2(filePath, r2Key);
  };

  await processDirectory(dirPath, uploadFile);
}

/**
 * Process a directory recursively
 * @param {string} dirPath - Directory path
 * @param {Function} fileCallback - Callback for each file
 */
async function processDirectory(dirPath, fileCallback) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await processDirectory(fullPath, fileCallback);
    } else {
      const relativePath = path.relative(dirPath, fullPath).replace(/\\/g, "/");
      await fileCallback(fullPath, relativePath);
    }
  }
}
