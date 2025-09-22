/**
 * Repository model representing the database entity
 */
export class Repository {
  constructor({
    repoId,
    userId,
    repoName,
    fullName,
    private: isPrivate,
    htmlUrl,
    description,
    language,
    ownerLogin,
    ownerAvatarUrl,
    deployYmlWorkflowId,
    deployYmlInjected,
    projectUrl,
    createdAt,
    updatedAt,
    deployStatus,
  }) {
    this.repoId = repoId;
    this.userId = userId;
    this.repoName = repoName;
    this.fullName = fullName;
    this.private = isPrivate;
    this.htmlUrl = htmlUrl;
    this.description = description;
    this.language = language;
    this.ownerLogin = ownerLogin;
    this.ownerAvatarUrl = ownerAvatarUrl;
    this.deployYmlWorkflowId = deployYmlWorkflowId;
    this.deployYmlInjected = deployYmlInjected;
    this.projectUrl = projectUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.deployStatus = deployStatus;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.repoId,
      name: this.repoName,
      full_name: this.fullName,
      private: this.private,
      html_url: this.htmlUrl,
      description: this.description,
      language: this.language,
      owner: {
        login: this.ownerLogin,
        avatar_url: this.ownerAvatarUrl,
      },
      deployStatus: this.deployStatus,
      projectUrl: this.projectUrl,
    };
  }

  // Convert to database format
  toDbFormat() {
    return {
      repoId: this.repoId,
      userId: this.userId,
      repoName: this.repoName,
      fullName: this.fullName,
      private: this.private,
      htmlUrl: this.htmlUrl,
      description: this.description,
      language: this.language,
      ownerLogin: this.ownerLogin,
      ownerAvatarUrl: this.ownerAvatarUrl,
      deployYmlWorkflowId: this.deployYmlWorkflowId,
      deployYmlInjected: this.deployYmlInjected,
      projectUrl: this.projectUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deployStatus: this.deployStatus,
    };
  }

  // Create from database row
  static fromDbRow(row) {
    return new Repository({
      repoId: row.repoId,
      userId: row.userId,
      repoName: row.repoName,
      fullName: row.fullName,
      private: row.private,
      htmlUrl: row.htmlUrl,
      description: row.description,
      language: row.language,
      ownerLogin: row.ownerLogin,
      ownerAvatarUrl: row.ownerAvatarUrl,
      deployYmlWorkflowId: row.deployYmlWorkflowId,
      deployYmlInjected: row.deployYmlInjected,
      projectUrl: row.projectUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deployStatus: row.deployStatus,
    });
  }
}
