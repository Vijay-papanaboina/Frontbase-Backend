import { uploadToR2, setKVMapping } from "../../services/storage.service.js";
import { processZipFile } from "../../services/upload.service.js";
import { updateDeploymentStatus } from "../../services/deployment.service.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import fs from "fs/promises";
import path from "path";

/**
 * Handle project upload and deployment
 */
export const uploadProject = asyncHandler(async (req, res) => {
  console.log("📦 Upload request received:", {
    fileSize: req.file?.size,
    fileName: req.file?.originalname,
    projectSlug: req.body.projectSlug,
    ownerLogin: req.body.ownerLogin,
    repoName: req.body.repoName,
    repoId: req.body.repoId || req.params.repo_id,
  });

  if (!req.file) {
    console.error("❌ No file uploaded");
    return res.status(400).json({ message: "No file uploaded." });
  }

  const repoId = req.body.repoId || req.params.repo_id;
  const { projectSlug, userEmail, githubId, ownerLogin, repoName } = req.body;

  if (!projectSlug || !ownerLogin || !repoName) {
    console.error("❌ Missing required fields:", {
      projectSlug,
      ownerLogin,
      repoName,
    });
    return res.status(400).json({
      message: "Missing required fields: projectSlug, ownerLogin, or repoName",
    });
  }

  console.log("✅ Upload validation passed, starting background processing");

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
    console.error("❌ Error in background upload processing:", error);
  });
});

/**
 * Process the uploaded file and deploy the project
 */
async function processUpload({
  req,
  zipFilePath,
  projectSlug,
  ownerLogin,
  repoName,
  repoId,
}) {
  console.log("🚀 Starting deployment process:", {
    projectSlug,
    ownerLogin,
    repoName,
    repoId,
    zipFilePath,
  });

  try {
    // Extract and process the zip file
    console.log("📁 Step 1: Extracting and processing zip file...");
    const { extractPath, distPath } = await processZipFile(
      zipFilePath,
      projectSlug
    );
    console.log("✅ Zip file processed successfully:", {
      extractPath,
      distPath,
      projectSlug,
    });

    // Upload files to R2
    console.log("☁️ Step 2: Uploading files to R2 storage...");
    await uploadFilesToR2(distPath, ownerLogin, repoName);
    console.log("✅ Files uploaded to R2 successfully");

    // Set up KV mapping for the subdomain
    console.log("🔗 Step 3: Setting up domain mapping...");
    const subdomain = `${ownerLogin}-${repoName}`;
    await setKVMapping(subdomain.toLowerCase(), `${ownerLogin}/${repoName}`);
    console.log("✅ Domain mapping created:", {
      subdomain: subdomain.toLowerCase(),
      mapping: `${ownerLogin}/${repoName}`,
    });

    // Update deployment status
    console.log("📊 Step 4: Updating deployment status...");
    await updateDeploymentStatus({
      repoName,
      ownerLogin,
      repoId,
      userId: req.user.userId,
      subdomain,
    });
    console.log("✅ Deployment status updated successfully");

    console.log("🎉 Deployment completed successfully:", {
      projectSlug,
      subdomain: subdomain.toLowerCase(),
      repoName,
      ownerLogin,
    });

    // Clean up temporary files after successful deployment
    console.log("🧹 Cleaning up temporary files...");
    await cleanupFiles(zipFilePath, extractPath);
    console.log("✅ Cleanup completed successfully");
  } catch (error) {
    console.error("❌ Error deploying project:", {
      error: error.message,
      stack: error.stack,
      projectSlug,
      ownerLogin,
      repoName,
    });

    // Clean up files even on error
    console.log("🧹 Cleaning up files after error...");
    await cleanupFiles(zipFilePath, extractPath).catch((cleanupError) =>
      console.error("❌ Error during cleanup:", cleanupError)
    );

    throw error;
  }
}

/**
 * Upload directory contents to R2
 */
async function uploadFilesToR2(dirPath, ownerLogin, repoName) {
  console.log("📤 Starting R2 upload process:", {
    dirPath,
    ownerLogin,
    repoName,
  });

  let fileCount = 0;
  const uploadFile = async (filePath, relativePath) => {
    const r2Key = `${ownerLogin}/${repoName}/${relativePath}`;
    console.log(`📄 Uploading file ${++fileCount}:`, {
      localPath: filePath,
      r2Key,
      relativePath,
    });
    await uploadToR2(filePath, r2Key);
  };

  await processDirectory(dirPath, uploadFile);
  console.log(`✅ Uploaded ${fileCount} files to R2 successfully`);
}

/**
 * Process a directory recursively
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

/**
 * Clean up temporary files after processing
 * @param {string} zipFilePath - Path to the original zip file
 * @param {string} extractPath - Path to the extracted directory
 */
async function cleanupFiles(zipFilePath, extractPath) {
  console.log("🗑️ Starting cleanup process:", {
    zipFilePath,
    extractPath,
  });

  try {
    // Delete the original zip file
    if (zipFilePath) {
      console.log("🗑️ Deleting zip file:", zipFilePath);
      await fs
        .unlink(zipFilePath)
        .catch((err) =>
          console.warn("⚠️ Could not delete zip file:", err.message)
        );
    }

    // Delete the extracted directory
    if (extractPath) {
      console.log("🗑️ Deleting extracted directory:", extractPath);
      await fs
        .rm(extractPath, { recursive: true, force: true })
        .catch((err) =>
          console.warn("⚠️ Could not delete extracted directory:", err.message)
        );
    }

    console.log("✅ Cleanup completed successfully");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}
