import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { User } from "../models/User.js";

/**
 * User Repository - Data access layer for User operations
 */
export class UserRepository {
  /**
   * Find user by GitHub ID
   * @param {string} githubId - GitHub user ID
   * @returns {Promise<User|null>} User object or null
   */
  async findByGithubId(githubId) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubId))
      .limit(1);
    return result[0] ? User.fromDbRow(result[0]) : null;
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @returns {Promise<User|null>} User object or null
   */
  async findById(userId) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return result[0] ? User.fromDbRow(result[0]) : null;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<User>} Created user
   */
  async create(userData) {
    const {
      githubId,
      userName,
      githubHandle,
      avatarUrl,
      htmlUrl,
      githubAccessToken,
      email,
    } = userData;

    const result = await db
      .insert(users)
      .values({
        githubId,
        userName,
        githubHandle,
        avatarUrl,
        htmlUrl,
        githubAccessToken,
        email,
      })
      .returning();

    return User.fromDbRow(result[0]);
  }

  /**
   * Update user's GitHub access token
   * @param {string} userId - User ID
   * @param {string} accessToken - New access token
   * @returns {Promise<User>} Updated user
   */
  async updateAccessToken(userId, accessToken) {
    const result = await db
      .update(users)
      .set({
        githubAccessToken: accessToken,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return User.fromDbRow(result[0]);
  }

  /**
   * Get user details (excluding sensitive data)
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User details or null
   */
  async getUserDetails(userId) {
    const result = await db
      .select({
        id: users.id,
        githubId: users.githubId,
        userName: users.userName,
        githubHandle: users.githubHandle,
        avatarUrl: users.avatarUrl,
        htmlUrl: users.htmlUrl,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get user with GitHub token (for internal operations)
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User with token or null
   */
  async getUserWithToken(userId) {
    const result = await db
      .select({
        githubAccessToken: users.githubAccessToken,
        githubId: users.githubId,
        email: users.email,
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] || null;
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
