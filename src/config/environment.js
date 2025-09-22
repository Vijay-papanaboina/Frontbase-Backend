import { z } from "zod";

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  JWT_SECRET: z.string().min(5, "JWT secret must be at least 32 characters"),
  GITHUB_OAUTH_CLIENT_ID: z
    .string()
    .min(1, "GitHub OAuth Client ID is required"),
  GITHUB_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1, "GitHub OAuth Client Secret is required"),
  BACKEND_URL: z.string().url("Backend URL must be a valid URL"),
  FRONTEND_URL: z.string().url("Frontend URL must be a valid URL"),
  R2_ENDPOINT: z.string().url("R2 endpoint must be a valid URL"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2 Access Key ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2 Secret Access Key is required"),
  R2_BUCKET_NAME: z.string().min(1, "R2 Bucket Name is required"),
});

// Validate environment variables
const validateEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error("❌ Environment validation failed:");
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }
};

export const env = validateEnv();
export default env;
