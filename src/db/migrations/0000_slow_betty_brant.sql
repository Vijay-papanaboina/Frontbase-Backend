CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repoId" bigint NOT NULL,
	"workflowRunId" bigint NOT NULL,
	"status" text,
	"conclusion" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"projectUrl" text,
	"htmlUrl" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "deployments_repoId_unique" UNIQUE("repoId"),
	CONSTRAINT "deployments_workflowRunId_unique" UNIQUE("workflowRunId"),
	CONSTRAINT "deployments_projectUrl_unique" UNIQUE("projectUrl")
);
--> statement-breakpoint
CREATE TABLE "repo_env_vars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"repoId" bigint NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "repo_env_vars_repoid_key_unique" UNIQUE("repoId","key")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
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
	"projectUrl" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"deployStatus" text DEFAULT 'not-deployed'
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"githubId" bigint NOT NULL,
	"user_name" text,
	"github_handle" text,
	"avatarUrl" text,
	"htmlUrl" text,
	"githubAccessToken" text,
	"email" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "users_githubId_unique" UNIQUE("githubId")
);
--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_repoId_repositories_repoId_fk" FOREIGN KEY ("repoId") REFERENCES "public"."repositories"("repoId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_env_vars" ADD CONSTRAINT "repo_env_vars_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_env_vars" ADD CONSTRAINT "repo_env_vars_repoId_repositories_repoId_fk" FOREIGN KEY ("repoId") REFERENCES "public"."repositories"("repoId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;