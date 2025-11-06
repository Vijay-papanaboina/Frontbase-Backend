# Frontbase Backend

REST API for Frontbase: GitHub OAuth auth, repository and deployment orchestration, environment variables, file uploads to Cloudflare R2, and subdomain mapping via Cloudflare KV.

- Frontend repo: [Frontbase-Frontend](https://github.com/Vijay-papanaboina/Frontbase-Frontend.git)
- Cloudflare Worker repo: [frontbase_cloudflare_worker](https://github.com/Vijay-papanaboina/frontbase_cloudflare_worker)

## Architecture

- Express app with modular routes, controllers, and services
- PostgreSQL via Drizzle ORM
- JWT cookie auth (httpOnly; SameSite set by env)
- GitHub OAuth and API integration (secrets, workflows)
- Cloudflare R2 (S3-compatible) file uploads
- Cloudflare KV mapping: subdomain -> R2 folder prefix (consumed by Worker)

### Directory Structure

```
backend/
  src/
    app.js                 # Express app wiring
    server.js              # Process bootstrap & graceful shutdown
    config/
      environment.js       # Env validation (zod)
      cors.js              # CORS allowlist
      database.js          # DB client (Drizzle)
      r2sdk.js             # R2 SDK setup (if used)
      index.js             # Re-exports
    routes/
      index.js             # Mounts API routes & docs
      auth/                # /api/auth (GitHub OAuth, me, logout)
      github/              # /api/github/* (repos, deployments, workflows)
      environment/         # /api/environment/variables
      upload/              # /api/upload
    controllers/           # Route handlers
    services/
      github.service.js    # GitHub OAuth & API helpers
      storage.service.js   # R2 upload, Cloudflare KV write
      deployment.service.js
      upload.service.js
    db/
      schema.js            # Drizzle schema
      index.js, db.js      # DB init
    middlewares/
      auth.js, errorHandler.js, validation.js
    utils/                 # constants, logger, r2 utils
    workflows/             # deploy.yml (reference)
```

## API Endpoints

Base URLs:

- Health: `GET /health`
- API root/docs: `GET /` (lists endpoints)

Auth (`/api/auth`):

- `GET /api/auth/github` — Initiate GitHub OAuth
- `GET /api/auth/github/callback` — OAuth callback
- `GET /api/auth/me` — Current user (requires auth cookie)
- `POST /api/auth/logout` — Logout, clears cookie

Environment Variables (`/api/environment/variables`):

- `GET /api/environment/variables/:repoId` — List env vars for repo
- `POST /api/environment/variables/:repoId` — Create/update env var
- `DELETE /api/environment/variables/:repoId` — Delete env var

GitHub Repositories (`/api/github/repositories`):

- `GET /api/github/repositories` — List repositories
- `GET /api/github/repositories/:repoId` — Get repository by ID

GitHub Deployments (`/api/github/deployments`):

- `GET /api/github/deployments/:repoId` — Get deployments for repo
- `GET /api/github/deployments/:repoId/status` — Get deployment status

GitHub Workflows (`/api/github/workflows`):

- `POST /api/github/workflows/:repoId/setup` — Inject/setup workflow
- `POST /api/github/workflows/:repoId/redeploy` — Trigger redeploy

Upload (`/api/upload`):

- `POST /api/upload/:repoId` — Upload project files for deployment

## Environment Variables

Copy `.env.example` to `.env` and fill values:

- Core
  - NODE_ENV (development|production|test)
  - PORT
  - DATABASE_URL
  - JWT_SECRET (32+ chars recommended)
- URLs
  - BACKEND_URL (e.g., http://localhost:3000)
  - FRONTEND_URL (e.g., http://localhost:5173)
- GitHub OAuth
  - GITHUB_OAUTH_CLIENT_ID
  - GITHUB_OAUTH_CLIENT_SECRET
  - GITHUB_OAUTH_URL (optional, default GitHub authorize URL)
  - GITHUB_TOKEN_URL (optional, default GitHub token URL)
- Cloudflare R2 (S3-compatible)
  - R2_ENDPOINT (e.g., https://<account>.r2.cloudflarestorage.com)
  - R2_ACCESS_KEY_ID
  - R2_SECRET_ACCESS_KEY
  - R2_BUCKET_NAME
- Cloudflare API (for KV writes from the backend)
  - CF_ACCOUNT_ID
  - KV_NAMESPACE_ID
  - CF_EMAIL
  - CF_API_KEY

These are validated in `src/config/environment.js` (R2 and URL fields are required).

## Local Setup

1. Install Node.js 18+ and PostgreSQL.
2. Install dependencies:
   - npm install
3. Create `.env` from `.env.example` and fill variables above.
4. Database:
   - Ensure `DATABASE_URL` points to a reachable PostgreSQL database.
   - Generate/apply migrations (see “Database & Migrations”).
5. Start:
   - npm run dev
   - Health: GET /health
   - API root: GET / (lists endpoints)

## Database & Migrations

- ORM: Drizzle ORM (PostgreSQL)
- Schema: `src/db/schema.js`
- Config: `drizzle.config.js` (output to `src/db/migrations`)

Typical flows:

- Generate SQL from schema:
  - npx drizzle-kit generate
- Apply/push schema:
  - npx drizzle-kit push

See `MIGRATION_GUIDE.md` for details if present.

## Integrations

- GitHub OAuth & API:
  - Login: `/api/auth/github`
  - Callback: `/api/auth/github/callback`
  - Token exchange via `getGithubToken`, user info via `getGithubUser`
  - Repo secrets injection using GitHub public-key crypto (`libsodium-wrappers`)
- Cloudflare R2:
  - Upload artifacts using S3-compatible client
- Cloudflare KV:
  - Map subdomains to R2 folder prefixes via REST API (requires CF creds)
- Auth:
  - JWT issued server-side and stored in httpOnly cookie
  - `GET /api/auth/me` requires `auth` middleware

## Deployment

- Targets: Render or Railway
- Steps:
  - Set all env vars (see above)
  - Ensure `FRONTEND_URL` is the deployed frontend origin
  - Ensure `BACKEND_URL` matches external URL (used in GitHub OAuth redirect)
  - PostgreSQL add-on or managed DB with `DATABASE_URL`
  - Expose `PORT` (platform sets it; app uses `env.PORT`)
- Cloudflare:
  - Ensure CF\_\* env vars are set for KV mapping calls

CORS:

- Allowed origins include `FRONTEND_URL` and `http://localhost:5173`.
- Update `src/config/cors.js` if additional domains are needed.

Cookies:

- In production, cookies are `secure` and `SameSite=None`; HTTPS is required for the frontend domain.

## Troubleshooting

- CORS errors:
  - Confirm frontend origin is in `allowedOrigins` and matches scheme/host/port.
- Cookie/session missing:
  - Use `credentials: "include"` on frontend requests (already implemented).
  - Ensure HTTPS + `SameSite=None` in production.
- GitHub OAuth redirect mismatch:
  - Align GitHub app callback URL with `${BACKEND_URL}/api/auth/github/callback`.
- R2 upload failures:
  - Verify R2 endpoint/keys/bucket.
- KV mapping failures:
  - Confirm CF_ACCOUNT_ID, KV_NAMESPACE_ID, CF_EMAIL, CF_API_KEY.
- DB migration issues:
  - Check `DATABASE_URL` and run drizzle generate/push.

## Cross-Links

- Frontend: https://github.com/Vijay-papanaboina/Frontbase-Frontend.git
- Cloudflare Worker: https://github.com/Vijay-papanaboina/frontbase_cloudflare_worker
