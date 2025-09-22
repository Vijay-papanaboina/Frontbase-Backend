import { pgTable, uuid, bigint, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  githubId: bigint("githubId", { mode: "number" }).notNull().unique(),
  userName: text("user_name"),
  githubHandle: text("github_handle"),
  avatarUrl: text("avatarUrl"),
  htmlUrl: text("htmlUrl"),
  githubAccessToken: text("githubAccessToken"),
  email: text("email"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Repositories table
export const repositories = pgTable("repositories", {
  repoId: bigint("repoId", { mode: "number" }).primaryKey().notNull(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  repoName: text("repoName").notNull(),
  fullName: text("fullName"),
  private: boolean("private"),
  htmlUrl: text("htmlUrl"),
  description: text("description"),
  language: text("language"),
  ownerLogin: text("ownerLogin").notNull(),
  ownerAvatarUrl: text("ownerAvatarUrl"),
  deployYmlWorkflowId: bigint("deployYmlWorkflowId", { mode: "number" }),
  deployYmlInjected: boolean("deployYmlInjected").default(false),
  projectUrl: text("projectUrl"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  deployStatus: text("deployStatus").default("not-deployed"),
});

// Deployments table
export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  repoId: bigint("repoId", { mode: "number" }).notNull().unique().references(() => repositories.repoId, { onDelete: "cascade" }),
  workflowRunId: bigint("workflowRunId", { mode: "number" }).notNull().unique(),
  status: text("status"),
  conclusion: text("conclusion"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  projectUrl: text("projectUrl").unique(),
  htmlUrl: text("htmlUrl"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Environment variables table
export const repoEnvVars = pgTable("repo_env_vars", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  repoId: bigint("repoId", { mode: "number" }).notNull().references(() => repositories.repoId, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  repoIdKeyUnique: unique("repo_env_vars_repoid_key_unique").on(table.repoId, table.key),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  repositories: many(repositories),
  envVars: many(repoEnvVars),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  user: one(users, {
    fields: [repositories.userId],
    references: [users.id],
  }),
  deployments: many(deployments),
  envVars: many(repoEnvVars),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  repository: one(repositories, {
    fields: [deployments.repoId],
    references: [repositories.repoId],
  }),
}));

export const repoEnvVarsRelations = relations(repoEnvVars, ({ one }) => ({
  user: one(users, {
    fields: [repoEnvVars.userId],
    references: [users.id],
  }),
  repository: one(repositories, {
    fields: [repoEnvVars.repoId],
    references: [repositories.repoId],
  }),
}));
