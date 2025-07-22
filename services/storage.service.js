import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import mime from "mime-types";

// Initialize S3 client for R2
const s3Client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to R2 storage
 * @param {string} filePath - Local file path
 * @param {string} r2Key - R2 storage key
 */
export async function uploadToR2(filePath, r2Key) {
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

/**
 * Set a KV mapping in Cloudflare
 * @param {string} key - KV key
 * @param {string} value - KV value
 */
export async function setKVMapping(key, value) {
  if (!(process.env.CF_EMAIL && process.env.CF_API_KEY)) {
    throw new Error("Missing Cloudflare credentials");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/storage/kv/namespaces/${process.env.KV_NAMESPACE_ID}/values/${key}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "text/plain",
      "X-Auth-Email": process.env.CF_EMAIL,
      "X-Auth-Key": process.env.CF_API_KEY,
    },
    body: value,
  });

  if (!response.ok) {
    throw new Error(`Failed to set KV mapping: ${await response.text()}`);
  }
}
