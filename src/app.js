import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Import configurations
import { corsConfig } from "./config/index.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

// Import routes
import routes from "./routes/index.js";

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create and configure Express application
 */
const createApp = () => {
  const app = express();

  // Trust proxy (for accurate IP addresses behind reverse proxy)
  app.set("trust proxy", 1);

  // CORS configuration
  app.use(cors(corsConfig));

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    });
  });

  // Root endpoint
  app.get("/", (req, res) => {
    res.status(200).json({
      message: "Frontbase Backend API",
      version: "1.0.0",
      status: "running",
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use(routes);

  // 404 handler for undefined routes
  app.use(notFoundHandler);

  // Global error handling middleware
  app.use(errorHandler);

  return app;
};

export default createApp;
