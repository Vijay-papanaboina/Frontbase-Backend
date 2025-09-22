import { env } from "./environment.js";

// CORS configuration
const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      env.FRONTEND_URL,
      "http://localhost:5173", // Vite default dev port
      "https://frontends.teakwoodfurniturepoint.online",
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

export default corsConfig;
