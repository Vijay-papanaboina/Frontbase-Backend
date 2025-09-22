/**
 * Application constants
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// GitHub OAuth Scopes
export const GITHUB_SCOPES = "user:email repo workflow";

// JWT Configuration
export const JWT_CONFIG = {
  EXPIRES_IN: "7d",
  REPO_TOKEN_EXPIRES_IN: "1y",
};

// Deployment Status
export const DEPLOYMENT_STATUS = {
  NOT_DEPLOYED: "not-deployed",
  PENDING: "pending",
  DEPLOYING: "deploying",
  DEPLOYED: "deployed",
  FAILED: "failed",
};

// Supported Frameworks
export const FRAMEWORKS = {
  REACT: "react",
  VITE: "vite",
  VUE: "vue",
  ANGULAR: "angular",
  NEXTJS: "nextjs",
  SVELTE: "svelte",
  CUSTOM: "custom",
};

// Framework Defaults
export const FRAMEWORK_DEFAULTS = {
  [FRAMEWORKS.REACT]: {
    buildCommand: "npm run build",
    outputFolder: "build",
  },
  [FRAMEWORKS.VITE]: {
    buildCommand: "npm run build",
    outputFolder: "dist",
  },
  [FRAMEWORKS.VUE]: {
    buildCommand: "npm run build",
    outputFolder: "dist",
  },
  [FRAMEWORKS.ANGULAR]: {
    buildCommand: "ng build --configuration production",
    outputFolder: "dist",
  },
  [FRAMEWORKS.NEXTJS]: {
    buildCommand: "npm run build && npm run export",
    outputFolder: "out",
  },
  [FRAMEWORKS.SVELTE]: {
    buildCommand: "npm run build",
    outputFolder: "public",
  },
};

// GitHub API
export const GITHUB_API = {
  BASE_URL: "https://api.github.com",
  OAUTH_URL: "https://github.com/login/oauth/authorize",
  TOKEN_URL: "https://github.com/login/oauth/access_token",
};

// File Upload
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_MIME_TYPES: ["application/zip", "application/x-zip-compressed"],
};

// Rate Limiting
export const RATE_LIMITS = {
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
  },
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  },
};
