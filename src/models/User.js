/**
 * User model representing the database entity
 */
export class User {
  constructor({
    id,
    githubId,
    userName,
    githubHandle,
    avatarUrl,
    htmlUrl,
    githubAccessToken,
    email,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.githubId = githubId;
    this.userName = userName;
    this.githubHandle = githubHandle;
    this.avatarUrl = avatarUrl;
    this.htmlUrl = htmlUrl;
    this.githubAccessToken = githubAccessToken;
    this.email = email;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Convert to JSON (exclude sensitive data)
  toJSON() {
    const { githubAccessToken, ...safeUser } = this;
    return safeUser;
  }

  // Convert to database format
  toDbFormat() {
    return {
      id: this.id,
      githubId: this.githubId,
      user_name: this.userName,
      github_handle: this.githubHandle,
      avatarUrl: this.avatarUrl,
      htmlUrl: this.htmlUrl,
      githubAccessToken: this.githubAccessToken,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Create from database row
  static fromDbRow(row) {
    return new User({
      id: row.id,
      githubId: row.githubId,
      userName: row.user_name,
      githubHandle: row.github_handle,
      avatarUrl: row.avatarUrl,
      htmlUrl: row.htmlUrl,
      githubAccessToken: row.githubAccessToken,
      email: row.email,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
