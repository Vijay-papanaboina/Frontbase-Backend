import { db } from "../db/index.js";
import { repositories } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { Repository } from "../models/Repository.js";

/**
 * Repository Repository - Data access layer for Repository operations
 */
export class RepositoryRepository {
  /**
   * Find repository by ID and user ID
   * @param {string} repoId - Repository ID
   * @param {string} userId - User ID
   * @returns {Promise<Repository|null>} Repository object or null
   */
  async findByIdAndUser(repoId, userId) {
    const result = await db
      .select()
      .from(repositories)
      .where(
        and(eq(repositories.repoId, repoId), eq(repositories.userId, userId))
      )
      .limit(1);
    return result[0] ? Repository.fromDbRow(result[0]) : null;
  }

  /**
   * Find repository by name and owner
   * @param {string} repoName - Repository name
   * @param {string} ownerLogin - Owner login
   * @returns {Promise<Repository|null>} Repository object or null
   */
  async findByNameAndOwner(repoName, ownerLogin) {
    const result = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.repoName, repoName),
          eq(repositories.ownerLogin, ownerLogin)
        )
      )
      .limit(1);
    return result[0] ? Repository.fromDbRow(result[0]) : null;
  }

  /**
   * Get all repositories for a user
   * @param {string} userId - User ID
   * @returns {Promise<Repository[]>} Array of repositories
   */
  async findByUser(userId) {
    const result = await db
      .select()
      .from(repositories)
      .where(eq(repositories.userId, userId))
      .orderBy(repositories.createdAt);
    return result.map((row) => Repository.fromDbRow(row));
  }

  /**
   * Create or update repository
   * @param {Object} repoData - Repository data
   * @returns {Promise<Repository>} Created/updated repository
   */
  async createOrUpdate(repoData) {
    const {
      repoId,
      repoName,
      ownerLogin,
      userId,
      deployYmlInjected = false,
      deployStatus = "pending",
    } = repoData;

    const result = await db
      .insert(repositories)
      .values({
        repoId,
        repoName,
        ownerLogin,
        userId,
        deployYmlInjected,
        deployStatus,
      })
      .onConflictDoUpdate({
        target: repositories.repoId,
        set: {
          repoName,
          ownerLogin,
          updatedAt: new Date(),
        },
      })
      .returning();

    return Repository.fromDbRow(result[0]);
  }

  /**
   * Update repository deployment status
   * @param {string} repoId - Repository ID
   * @param {string} status - Deployment status
   * @returns {Promise<Repository>} Updated repository
   */
  async updateDeployStatus(repoId, status) {
    const result = await db
      .update(repositories)
      .set({
        deployStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(repositories.repoId, repoId))
      .returning();

    return Repository.fromDbRow(result[0]);
  }

  /**
   * Update repository workflow information
   * @param {string} repoId - Repository ID
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<Repository>} Updated repository
   */
  async updateWorkflowInfo(repoId, workflowId) {
    const result = await db
      .update(repositories)
      .set({
        deployYmlInjected: true,
        deployYmlWorkflowId: workflowId,
        updatedAt: new Date(),
      })
      .where(eq(repositories.repoId, repoId))
      .returning();

    return Repository.fromDbRow(result[0]);
  }

  /**
   * Update repository project URL
   * @param {string} repoName - Repository name
   * @param {string} ownerLogin - Owner login
   * @param {string} projectUrl - Project URL
   * @returns {Promise<Repository>} Updated repository
   */
  async updateProjectUrl(repoName, ownerLogin, projectUrl) {
    const result = await db
      .update(repositories)
      .set({
        projectUrl,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(repositories.repoName, repoName),
          eq(repositories.ownerLogin, ownerLogin)
        )
      )
      .returning();

    return Repository.fromDbRow(result[0]);
  }

  /**
   * Delete repository
   * @param {string} repoId - Repository ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(repoId, userId) {
    const result = await db
      .delete(repositories)
      .where(
        and(eq(repositories.repoId, repoId), eq(repositories.userId, userId))
      )
      .returning();

    return result.length > 0;
  }
}

// Export singleton instance
export const repositoryRepository = new RepositoryRepository();
