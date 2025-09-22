import "dotenv/config";
import { env } from "./config/environment.js";
import createApp from "./app.js";

// Create Express application
const app = createApp();

// Start server
const server = app.listen(env.PORT, () => {
  console.log(`
🚀 Frontbase Backend Server
   Environment: ${env.NODE_ENV}
   Port: ${env.PORT}
   URL: http://localhost:${env.PORT}
   Health: http://localhost:${env.PORT}/health
  `);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error("❌ Error during server shutdown:", err);
      process.exit(1);
    }

    console.log("✅ Server closed successfully");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message, err.stack);
  process.exit(1);
});
