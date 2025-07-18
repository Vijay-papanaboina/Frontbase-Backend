# Frontbase Backend

This is the backend for the Frontbase platform, built with Node.js, Express, PostgreSQL, and Cloudflare R2. It provides APIs for authentication, repository management, deployment automation, environment variable management, and file uploads.

## Features

- **Authentication**: JWT-based authentication with secure cookie/session management.
- **GitHub Integration**: Manage repositories, inject secrets, and trigger GitHub Actions workflows.
- **Deployment Automation**: Handles file uploads, triggers deployments, and polls for workflow completion.
- **Cloudflare R2 Integration**: Uploads static files to R2 for CDN hosting.
- **Environment Variables**: Securely manage per-repo environment variables.
- **Status Polling**: Real-time deployment status via dedicated API endpoints.
- **Robust Error Handling**: Centralized error middleware and logging.

## Project Structure

```
backend/
  controllers/        # Main business logic (auth, upload, github, envs)
    github/           # Modular controllers for GitHub integration
  db/                 # Database connection and schema
  middlewares/        # Express middlewares (auth, error handling)
  routes/             # API route definitions
  uploads/            # Temporary file storage for uploads
  utils/              # Utility functions
  workflows/          # Workflow templates (e.g., deploy.yml)
  server.js           # Main server entry point
  package.json        # Dependencies and scripts
```

## Database Schema

- **users**: Stores user info and GitHub tokens
- **repositories**: Tracks repos, workflow status, and deployment state
- **deployments**: Stores deployment runs, status, and URLs
- **repo_env_vars**: Per-repo environment variables

See [`db/schema.sql`](db/schema.sql) for full details.

## Main API Endpoints

- `POST /api/auth/login` — User login (GitHub OAuth)
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user info
- `GET /api/github/repos` — List user repositories
- `POST /api/github/repos/:repo_id/setup` — Setup deployment workflow for a repo
- `POST /api/github/repos/:repo_id/deploy` — Trigger deployment
- `GET /api/github/repos/:repo_id/deployment-status` — Poll deployment status
- `POST /api/upload` — Upload a project zip for deployment
- `GET /api/envs/:repo_id` — Get environment variables for a repo
- `POST /api/envs/:repo_id` — Set environment variables for a repo

## Environment Variables

Create a `.env` file in the `backend/` directory with:

```
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/frontbase
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_r2_bucket
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_KEY=your_cloudflare_api_key
CF_EMAIL=your_cloudflare_email
KV_NAMESPACE_ID=your_kv_namespace_id
BACKEND_URL=http://localhost:3000
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL
- Cloudflare R2 credentials

### Setup

1. Install dependencies:
   ```sh
   npm install
   ```
2. Set up your `.env` file as above.
3. Initialize the database:
   ```sh
   psql < db/schema.sql
   # or run the schema in your DB tool
   ```
4. Start the server:
   ```sh
   npm run dev
   # or
   npm start
   ```

## Development

- Uses `nodemon` for hot-reloading in development (`npm run dev`).
- All API routes are prefixed with `/api/`.
- Logs are written to the console and `error.log`/`combined.log`.

## Deployment

- Designed for deployment on platforms like Render, Railway, or your own VPS.
- Make sure to set all required environment variables in your deployment environment.

## Contributing

Pull requests and issues are welcome! Please follow the existing code style and structure.

## License

MIT
