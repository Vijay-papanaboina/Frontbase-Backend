import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadFileToR2(key, body, contentType) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  try {
    const response = await r2Client.send(command);
    console.log(`Successfully uploaded ${key} to R2:`, response);
    return `https://${process.env.R2_ENDPOINT.split("//")[1]}/${
      process.env.R2_BUCKET_NAME
    }/${key}`;
  } catch (error) {
    console.error(`Error uploading ${key} to R2:`, error);
    throw error;
  }
}
