import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import db from "./db/db.js";
import uploadRouter from "./routes/upload.js";
import githubRoutes from "./routes/github.js";
import authRoutes from "./routes/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173", // Vite default dev port
  "https://frontends.teakwoodfurniturepoint.online",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize database schema (for PostgreSQL)
// const schemaPath = path.join(__dirname, "db", "schema.sql");
// const schemaSql = fs.readFileSync(schemaPath, "utf8");

// // Use pool.query for PostgreSQL schema initialization
// db.query(schemaSql)
//   .then(() => console.log("PostgreSQL schema initialized."))
//   .catch((err) => console.error("Error initializing PostgreSQL schema:", err));

// Mount the upload router
app.use("/api/upload", uploadRouter);

// Mount the GitHub routes
app.use("/api/github", githubRoutes);

// Mount the auth routes
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Backend server is running!");
  console.log("Root endpoint accessed.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.message, err);
  res.status(500).send("Something broke!");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Application should exit if not handled properly
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message, err.stack);
  // Application should exit after logging uncaught exceptions
  process.exit(1);
});
