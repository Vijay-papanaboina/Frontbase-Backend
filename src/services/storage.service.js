import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import mime from "mime-types";
import { env } from "../config/environment.js";

// Initialize S3 client for R2
const s3Client = new S3Client({
  endpoint: env.R2_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to R2 storage
 * @param {string} filePath - Local file path
 * @param {string} r2Key - R2 storage key
 */
export async function uploadToR2(filePath, r2Key) {
  console.log("☁️ Uploading to R2:", {
    filePath,
    r2Key,
    bucket: env.R2_BUCKET_NAME,
  });

  const fileContent = await fs.readFile(filePath);
  const contentType = mime.lookup(r2Key) || "application/octet-stream";

  console.log("📄 File details:", {
    size: fileContent.length,
    contentType,
    r2Key,
  });

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileContent,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(
      `✅ Successfully uploaded ${r2Key} to R2 (${fileContent.length} bytes)`
    );
  } catch (error) {
    console.error(`❌ Failed to upload ${r2Key} to R2:`, {
      error: error.message,
      r2Key,
      filePath,
      bucket: env.R2_BUCKET_NAME,
    });
    throw error;
  }
}

/**
 * Set a KV mapping in Cloudflare
 * @param {string} key - KV key
 * @param {string} value - KV value
 */
export async function setKVMapping(key, value) {
  console.log("🔗 Setting KV mapping:", {
    key,
    value,
    accountId: process.env.CF_ACCOUNT_ID,
    namespaceId: process.env.KV_NAMESPACE_ID,
  });

  if (!(process.env.CF_EMAIL && process.env.CF_API_KEY)) {
    console.error("❌ Missing Cloudflare credentials");
    throw new Error("Missing Cloudflare credentials");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/storage/kv/namespaces/${process.env.KV_NAMESPACE_ID}/values/${key}`;

  console.log("🌐 Making KV API request:", {
    url,
    method: "PUT",
    key,
    value,
  });

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
    const errorText = await response.text();
    console.error("❌ Failed to set KV mapping:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      key,
      value,
    });
    throw new Error(`Failed to set KV mapping: ${errorText}`);
  }

  console.log("✅ KV mapping set successfully:", {
    key,
    value,
    status: response.status,
  });
}
