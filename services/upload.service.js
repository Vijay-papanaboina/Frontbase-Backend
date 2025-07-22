import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import yauzl from "yauzl-promise";
import { ensureDirectory, deleteFileIfExists } from "./file.service.js";

/**
 * Process a zip file, extracting its contents
 * @param {string} zipFilePath - Path to zip file
 * @param {string} projectSlug - Project identifier
 * @returns {Promise<Object>} Paths to extracted files
 */
export async function processZipFile(zipFilePath, projectSlug) {
  const extractPath = path.join("uploads", projectSlug);

  try {
    await ensureDirectory(extractPath);
    await extractZipFile(zipFilePath, extractPath);

    return {
      extractPath,
      distPath: path.join(extractPath, "dist"),
    };
  } catch (error) {
    await cleanup(zipFilePath, extractPath);
    throw error;
  }
}

/**
 * Extract a zip file to a directory
 * @param {string} zipFilePath - Path to zip file
 * @param {string} extractPath - Extraction directory
 */
async function extractZipFile(zipFilePath, extractPath) {
  const zip = await yauzl.open(zipFilePath);

  try {
    for await (const entry of zip) {
      const entryPath = path.join(extractPath, entry.filename);

      if (entry.filename.endsWith("/")) {
        await ensureDirectory(entryPath);
      } else {
        await ensureDirectory(path.dirname(entryPath));
        await extractEntry(entry, entryPath);
      }
    }
  } finally {
    await zip.close();
  }
}

/**
 * Extract a single zip entry
 * @param {Object} entry - Zip entry
 * @param {string} targetPath - Target path
 */
async function extractEntry(entry, targetPath) {
  const readStream = await entry.openReadStream();
  const writeStream = createWriteStream(targetPath);

  return new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    readStream.pipe(writeStream);
  });
}

/**
 * Clean up temporary files
 * @param {string} zipPath - Path to zip file
 * @param {string} extractPath - Path to extracted files
 */
async function cleanup(zipPath, extractPath) {
  await Promise.all([
    deleteFileIfExists(zipPath),
    fs
      .rm(extractPath, { recursive: true, force: true })
      .catch((err) => console.error("Failed to remove extract path:", err)),
  ]);
}
