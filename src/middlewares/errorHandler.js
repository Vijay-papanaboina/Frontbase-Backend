import { env } from "../config/environment.js";

/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Log error
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Default error
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal Server Error";

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
  } else if (err.name === "ForbiddenError") {
    statusCode = 403;
    message = "Forbidden";
  } else if (err.name === "NotFoundError") {
    statusCode = 404;
    message = "Not Found";
  } else if (err.code === "23505") {
    // PostgreSQL unique violation
    statusCode = 409;
    message = "Resource already exists";
  } else if (err.code === "23503") {
    // PostgreSQL foreign key violation
    statusCode = 400;
    message = "Invalid reference";
  }

  // Don't leak error details in production
  if (env.NODE_ENV === "production" && statusCode === 500) {
    message = "Internal Server Error";
  }

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      ...(env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      status: 404,
    },
  });
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
