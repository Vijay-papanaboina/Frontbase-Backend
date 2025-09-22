import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/environment.js";

const r2Client = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadFileToR2(key, body, contentType) {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  try {
    const response = await r2Client.send(command);
    console.log(`Successfully uploaded ${key} to R2:`, response);
    return `https://${env.R2_ENDPOINT.split("//")[1]}/${
      env.R2_BUCKET_NAME
    }/${key}`;
  } catch (error) {
    console.error(`Error uploading ${key} to R2:`, error);
    throw error;
  }
}
