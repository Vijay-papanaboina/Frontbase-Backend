import { z } from "zod";

/**
 * Validation middleware factory
 * @param {z.ZodSchema} schema - Zod validation schema
 * @param {string} target - Where to validate ('body', 'query', 'params')
 */
export const validate = (schema, target = "body") => {
  return (req, res, next) => {
    try {
      const data = req[target];
      const validatedData = schema.parse(data);
      req[target] = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            message: "Validation failed",
            status: 400,
            details: error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
              code: err.code,
            })),
          },
        });
      }
      next(error);
    }
  };
};

// Common validation schemas
export const schemas = {
  // Auth schemas
  githubCallback: z.object({
    code: z.string().min(1, "Authorization code is required"),
  }),

  // Repository schemas
  repoId: z.object({
    repoId: z.string().regex(/^\d+$/, "Repository ID must be a number"),
  }),

  // Workflow setup schema
  workflowSetup: z.object({
    repoName: z.string().min(1, "Repository name is required"),
    ownerLogin: z.string().min(1, "Owner login is required"),
    envVars: z
      .array(
        z.object({
          key: z.string().min(1, "Environment variable key is required"),
          value: z.string(),
        })
      )
      .optional(),
    framework: z.string().optional(),
    buildCommand: z.string().min(1, "Build command is required"),
    outputFolder: z.string().min(1, "Output folder is required"),
  }),

  // Environment variables schema
  envVars: z.object({
    repoId: z.string().regex(/^\d+$/, "Repository ID must be a number"),
  }),

  envVarBody: z.object({
    key: z.string().min(1, "Environment variable key is required"),
    value: z.string().min(1, "Environment variable value is required"),
  }),

  // Upload schema
  upload: z.object({
    repoId: z.string().regex(/^\d+$/, "Repository ID must be a number"),
  }),
};
