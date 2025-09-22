import { db } from "../db/index.js";
import { deployments, repositories } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { Deployment } from "../models/Deployment.js";

/**
 * Deployment Repository - Data access layer for Deployment operations
 */
export class DeploymentRepository {
  /**
   * Find deployment by repository ID
   * @param {string} repoId - Repository ID
   * @returns {Promise<Deployment|null>} Deployment object or null
   */
  async findByRepoId(repoId) {
    const result = await db
      .select()
      .from(deployments)
      .where(eq(deployments.repoId, repoId))
      .limit(1);
    return result[0] ? Deployment.fromDbRow(result[0]) : null;
  }

  /**
   * Find deployment by workflow run ID
   * @param {string} workflowRunId - Workflow run ID
   * @returns {Promise<Deployment|null>} Deployment object or null
   */
  async findByWorkflowRunId(workflowRunId) {
    const result = await db
      .select()
      .from(deployments)
      .where(eq(deployments.workflowRunId, workflowRunId))
      .limit(1);
    return result[0] ? Deployment.fromDbRow(result[0]) : null;
  }

  /**
   * Get all deployments for a user's repositories
   * @param {string} userId - User ID
   * @returns {Promise<Deployment[]>} Array of deployments
   */
  async findByUser(userId) {
    const result = await db
      .select({
        id: deployments.id,
        repoId: deployments.repoId,
        workflowRunId: deployments.workflowRunId,
        status: deployments.status,
        conclusion: deployments.conclusion,
        startedAt: deployments.startedAt,
        completedAt: deployments.completedAt,
        projectUrl: deployments.projectUrl,
        htmlUrl: deployments.htmlUrl,
        createdAt: deployments.createdAt,
        updatedAt: deployments.updatedAt,
      })
      .from(deployments)
      .innerJoin(repositories, eq(deployments.repoId, repositories.repoId))
      .where(eq(repositories.userId, userId))
      .orderBy(deployments.createdAt);

    return result.map((row) => Deployment.fromDbRow(row));
  }

  /**
   * Create or update deployment
   * @param {Object} deploymentData - Deployment data
   * @returns {Promise<Deployment>} Created/updated deployment
   */
  async createOrUpdate(deploymentData) {
    const {
      repoId,
      workflowRunId,
      status,
      conclusion,
      startedAt,
      completedAt,
      projectUrl,
      htmlUrl,
    } = deploymentData;

    const result = await db
      .insert(deployments)
      .values({
        repoId,
        workflowRunId,
        status,
        conclusion,
        startedAt,
        completedAt,
        projectUrl,
        htmlUrl,
      })
      .onConflictDoUpdate({
        target: deployments.repoId,
        set: {
          workflowRunId,
          status,
          conclusion,
          startedAt,
          completedAt,
          htmlUrl,
          projectUrl,
        },
      })
      .returning();

    return Deployment.fromDbRow(result[0]);
  }

  /**
   * Update deployment status
   * @param {string} repoId - Repository ID
   * @param {string} status - Deployment status
   * @param {string} conclusion - Deployment conclusion
   * @returns {Promise<Deployment>} Updated deployment
   */
  async updateStatus(repoId, status, conclusion = null) {
    const result = await db
      .update(deployments)
      .set({
        status,
        conclusion,
        updatedAt: new Date(),
      })
      .where(eq(deployments.repoId, repoId))
      .returning();

    return Deployment.fromDbRow(result[0]);
  }

  /**
   * Delete deployment
   * @param {string} repoId - Repository ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(repoId) {
    const result = await db
      .delete(deployments)
      .where(eq(deployments.repoId, repoId))
      .returning();

    return result.length > 0;
  }

  /**
   * Get deployment statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deployment statistics
   */
  async getStats(userId) {
    const result = await db
      .select({
        total: sql`COUNT(*)`,
        successful: sql`COUNT(CASE WHEN ${deployments.status} = 'completed' AND ${deployments.conclusion} = 'success' THEN 1 END)`,
        failed: sql`COUNT(CASE WHEN ${deployments.status} = 'completed' AND ${deployments.conclusion} = 'failure' THEN 1 END)`,
        in_progress: sql`COUNT(CASE WHEN ${deployments.status} = 'in_progress' THEN 1 END)`,
      })
      .from(deployments)
      .innerJoin(repositories, eq(deployments.repoId, repositories.repoId))
      .where(eq(repositories.userId, userId));

    return result[0];
  }
}

// Export singleton instance
export const deploymentRepository = new DeploymentRepository();
