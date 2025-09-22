/**
 * Deployment model representing the database entity
 */
export class Deployment {
  constructor({
    id,
    repoId,
    workflowRunId,
    status,
    conclusion,
    startedAt,
    completedAt,
    projectUrl,
    htmlUrl,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.repoId = repoId;
    this.workflowRunId = workflowRunId;
    this.status = status;
    this.conclusion = conclusion;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.projectUrl = projectUrl;
    this.htmlUrl = htmlUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      repoId: this.repoId,
      workflowRunId: this.workflowRunId,
      status: this.status,
      conclusion: this.conclusion,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      projectUrl: this.projectUrl,
      htmlUrl: this.htmlUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Convert to database format
  toDbFormat() {
    return {
      id: this.id,
      repoId: this.repoId,
      workflowRunId: this.workflowRunId,
      status: this.status,
      conclusion: this.conclusion,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      projectUrl: this.projectUrl,
      htmlUrl: this.htmlUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Create from database row
  static fromDbRow(row) {
    return new Deployment({
      id: row.id,
      repoId: row.repoId,
      workflowRunId: row.workflowRunId,
      status: row.status,
      conclusion: row.conclusion,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      projectUrl: row.projectUrl,
      htmlUrl: row.htmlUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
