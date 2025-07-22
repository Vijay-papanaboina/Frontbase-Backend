import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Read the workflow template file
 * @returns {Promise<string>} Template content
 */
export async function readWorkflowTemplate() {
  const templatePath = path.join(__dirname, "..", "workflows", "deploy.yml");

  try {
    const content = await fs.readFile(templatePath, "utf-8");
    if (!content) {
      throw new Error("Workflow template is empty");
    }
    return content;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Workflow template not found at: ${templatePath}`);
    }
    throw error;
  }
}

/**
 * Ensure a directory exists, create if it doesn't
 * @param {string} dirPath - Directory path
 */
export async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Delete a file if it exists
 * @param {string} filePath - File path
 */
export async function deleteFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Get file stats if file exists
 * @param {string} filePath - File path
 * @returns {Promise<fs.Stats|null>} File stats or null if file doesn't exist
 */
export async function getFileStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Create temporary directory
 * @param {string} prefix - Directory name prefix
 * @returns {Promise<string>} Path to created directory
 */
export async function createTempDirectory(prefix) {
  const tempDir = path.join("uploads", `${prefix}-${Date.now()}`);
  await ensureDirectory(tempDir);
  return tempDir;
}

/**
 * Clean up temporary directory
 * @param {string} dirPath - Directory path
 */
export async function cleanupTempDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to cleanup directory ${dirPath}:`, error);
  }
}
