import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import yauzl from "yauzl-promise";
import mime from "mime-types";

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

    res.status(200).json({
      message: "Project deployed successfully!",
      // TODO: Add deployment URL
    });
  } catch (error) {
    console.error("Error deploying project:", error);
    res
      .status(500)
      .json({ message: "Failed to deploy project", error: error.message });
  } finally {
    // Clean up temporary files
    await fs
      .rm(zipFilePath, { recursive: true, force: true })
      .catch((err) => console.error("Failed to remove zip file:", err));
    await fs
      .rm(extractPath, { recursive: true, force: true })
      .catch((err) => console.error("Failed to remove extract path:", err));
  }
};
