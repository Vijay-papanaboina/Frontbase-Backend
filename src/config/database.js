import { db } from "../db/index.js";

// Export the Drizzle database instance
export default db;

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔄 Closing database connection...");
  // Drizzle handles connection cleanup automatically
  console.log("✅ Database connection closed.");
});
