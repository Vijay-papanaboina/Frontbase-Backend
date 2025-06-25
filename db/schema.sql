-- USERS TABLE

DROP TABLE IF EXISTS "users" CASCADE;
CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "githubId" bigint NOT NULL UNIQUE,
    "user_name" text,
    "github_handle" text,
    "avatarUrl" text,
    "htmlUrl" text,
    "githubAccessToken" text,
    "email" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- REPOSITORIES TABLE
CREATE TABLE IF NOT EXISTS "repositories" (
    "repoId" bigint PRIMARY KEY NOT NULL,
    "userId" uuid NOT NULL,
    "repoName" text NOT NULL,
    "fullName" text,
    "private" boolean,
    "htmlUrl" text,
    "description" text,
    "language" text,
    "ownerLogin" text NOT NULL,
    "ownerAvatarUrl" text,
    "deployYmlWorkflowId" bigint,
    "deployYmlInjected" boolean DEFAULT false,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    "deployStatus" text DEFAULT 'not-deployed',
    CONSTRAINT "repositories_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

-- DEPLOYMENTS TABLE
CREATE TABLE IF NOT EXISTS "deployments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "repoId" bigint NOT NULL,
    "workflowRunId" bigint NOT NULL UNIQUE,
    "status" text,
    "conclusion" text,
    "startedAt" timestamp,
    "completedAt" timestamp,
    "htmlUrl" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "deployments_repoId_repositories_repoId_fk" FOREIGN KEY ("repoId") REFERENCES "repositories"("repoId") ON DELETE CASCADE
);

-- ENVIRONMENT VARIABLES TABLE
CREATE TABLE IF NOT EXISTS "repo_env_vars" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "repoId" bigint NOT NULL,
    "key" text NOT NULL,
    "value" text NOT NULL,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "repo_env_vars_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "repo_env_vars_repoId_repositories_repoId_fk" FOREIGN KEY ("repoId") REFERENCES "repositories"("repoId") ON DELETE CASCADE
);
