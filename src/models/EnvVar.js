/**
 * Environment Variable model representing the database entity
 */
export class EnvVar {
  constructor({ id, userId, repoId, key, value, createdAt, updatedAt }) {
    this.id = id;
    this.userId = userId;
    this.repoId = repoId;
    this.key = key;
    this.value = value;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Convert to JSON (exclude sensitive value)
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      repoId: this.repoId,
      key: this.key,
      value: this.value, // Include value for internal use
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Convert to safe JSON (mask value)
  toSafeJSON() {
    return {
      id: this.id,
      userId: this.userId,
      repoId: this.repoId,
      key: this.key,
      value: this.value ? "***" : "",
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Convert to database format
  toDbFormat() {
    return {
      id: this.id,
      userId: this.userId,
      repoId: this.repoId,
      key: this.key,
      value: this.value,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Create from database row
  static fromDbRow(row) {
    return new EnvVar({
      id: row.id,
      userId: row.userId,
      repoId: row.repoId,
      key: row.key,
      value: row.value,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
