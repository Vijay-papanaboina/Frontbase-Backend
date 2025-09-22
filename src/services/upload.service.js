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
  console.log("📦 Processing zip file:", {
    zipFilePath,
    projectSlug,
  });

  const extractPath = path.join("uploads", projectSlug);

  try {
    console.log("📁 Creating extraction directory:", extractPath);
    await ensureDirectory(extractPath);

    console.log("🗜️ Extracting zip file...");
    await extractZipFile(zipFilePath, extractPath);
    console.log("✅ Zip file extracted successfully");

    const distPath = path.join(extractPath, "dist");
    console.log("📂 Extracted paths:", {
      extractPath,
      distPath,
    });

    return {
      extractPath,
      distPath,
    };
  } catch (error) {
    console.error("❌ Error processing zip file:", {
      error: error.message,
      zipFilePath,
      projectSlug,
    });
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
  console.log("🗜️ Opening zip file:", zipFilePath);
  const zip = await yauzl.open(zipFilePath);

  let fileCount = 0;
  let dirCount = 0;

  try {
    for await (const entry of zip) {
      const entryPath = path.join(extractPath, entry.filename);

      if (entry.filename.endsWith("/")) {
        console.log(`📁 Creating directory: ${entry.filename}`);
        await ensureDirectory(entryPath);
        dirCount++;
      } else {
        console.log(
          `📄 Extracting file: ${entry.filename} (${entry.uncompressedSize} bytes)`
        );
        await ensureDirectory(path.dirname(entryPath));
        await extractEntry(entry, entryPath);
        fileCount++;
      }
    }

    console.log("✅ Zip extraction completed:", {
      filesExtracted: fileCount,
      directoriesCreated: dirCount,
      extractPath,
    });
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
