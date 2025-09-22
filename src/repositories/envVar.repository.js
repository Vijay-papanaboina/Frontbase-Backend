import { db } from "../db/index.js";
import { repoEnvVars } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { EnvVar } from "../models/EnvVar.js";

/**
 * Environment Variable Repository - Data access layer for EnvVar operations
 */
export class EnvVarRepository {
  /**
   * Find environment variables by repository ID
   * @param {string} repoId - Repository ID
   * @returns {Promise<EnvVar[]>} Array of environment variables
   */
  async findByRepoId(repoId) {
    const result = await db
      .select()
      .from(repoEnvVars)
      .where(eq(repoEnvVars.repoId, repoId))
      .orderBy(repoEnvVars.createdAt);

    return result.map((row) => EnvVar.fromDbRow(row));
  }

  /**
   * Find environment variable by repository ID and key
   * @param {string} repoId - Repository ID
   * @param {string} key - Environment variable key
   * @returns {Promise<EnvVar|null>} Environment variable or null
   */
  async findByRepoIdAndKey(repoId, key) {
    const result = await db
      .select()
      .from(repoEnvVars)
      .where(and(eq(repoEnvVars.repoId, repoId), eq(repoEnvVars.key, key)))
      .limit(1);

    return result[0] ? EnvVar.fromDbRow(result[0]) : null;
  }

  /**
   * Get all environment variables for a user
   * @param {string} userId - User ID
   * @returns {Promise<EnvVar[]>} Array of environment variables
   */
  async findByUser(userId) {
    const result = await db
      .select()
      .from(repoEnvVars)
      .where(eq(repoEnvVars.userId, userId))
      .orderBy(repoEnvVars.createdAt);

    return result.map((row) => EnvVar.fromDbRow(row));
  }

  /**
   * Create environment variable
   * @param {Object} envVarData - Environment variable data
   * @returns {Promise<EnvVar>} Created environment variable
   */
  async create(envVarData) {
    const { userId, repoId, key, value } = envVarData;

    const result = await db
      .insert(repoEnvVars)
      .values({
        userId,
        repoId,
        key,
        value,
      })
      .returning();

    return EnvVar.fromDbRow(result[0]);
  }

  /**
   * Create or update environment variable
   * @param {Object} envVarData - Environment variable data
   * @returns {Promise<EnvVar>} Created/updated environment variable
   */
  async createOrUpdate(envVarData) {
    const { userId, repoId, key, value } = envVarData;

    const result = await db
      .insert(repoEnvVars)
      .values({
        userId,
        repoId,
        key,
        value,
      })
      .onConflictDoUpdate({
        target: [repoEnvVars.repoId, repoEnvVars.key],
        set: {
          value,
          updatedAt: new Date(),
        },
      })
      .returning();

    return EnvVar.fromDbRow(result[0]);
  }

  /**
   * Update environment variable
   * @param {string} id - Environment variable ID
   * @param {string} value - New value
   * @returns {Promise<EnvVar>} Updated environment variable
   */
  async update(id, value) {
    const result = await db
      .update(repoEnvVars)
      .set({
        value,
        updatedAt: new Date(),
      })
      .where(eq(repoEnvVars.id, id))
      .returning();

    return EnvVar.fromDbRow(result[0]);
  }

  /**
   * Delete environment variable
   * @param {string} id - Environment variable ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id, userId) {
    const result = await db
      .delete(repoEnvVars)
      .where(and(eq(repoEnvVars.id, id), eq(repoEnvVars.userId, userId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Delete environment variable by repository ID and key
   * @param {string} repoId - Repository ID
   * @param {string} key - Environment variable key
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteByRepoIdAndKey(repoId, key, userId) {
    const result = await db
      .delete(repoEnvVars)
      .where(
        and(
          eq(repoEnvVars.repoId, repoId),
          eq(repoEnvVars.key, key),
          eq(repoEnvVars.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Delete all environment variables for a repository
   * @param {string} repoId - Repository ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteByRepoId(repoId, userId) {
    const result = await db
      .delete(repoEnvVars)
      .where(
        and(eq(repoEnvVars.repoId, repoId), eq(repoEnvVars.userId, userId))
      )
      .returning();

    return result.length;
  }

  /**
   * Bulk create environment variables
   * @param {Array} envVars - Array of environment variable data
   * @returns {Promise<EnvVar[]>} Array of created environment variables
   */
  async bulkCreate(envVars) {
    if (envVars.length === 0) return [];

    const result = await db.insert(repoEnvVars).values(envVars).returning();
    return result.map((row) => EnvVar.fromDbRow(row));
  }
}

// Export singleton instance
export const envVarRepository = new EnvVarRepository();
