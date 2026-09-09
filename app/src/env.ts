import { defineEnvValidationSchema } from "wasp/env";

import * as z from "zod";
import { authEnvSchema } from "./auth/env";

// Wasp merges this schema with its built-in env var validations and uses it
// to validate `process.env` at server startup. Access the validated env vars
// with `import { env } from 'wasp/server'` instead of using `process.env` directly.
export const serverEnvValidationSchema = defineEnvValidationSchema(
  z.object({
    ...authEnvSchema.shape,
    OPENROUTER_API_KEY: z.string(),
    // Modelo de IA configurable (default: meta-llama/llama-3.3-70b-instruct:free o configurable vía env).
    OPENROUTER_MODEL: z
      .string()
      .default("meta-llama/llama-3.3-70b-instruct:free"),
    // ICD-11 (CIE-11) — API oficial de la OMS.
    ICD11_CLIENT_ID: z.string().optional(),
    ICD11_CLIENT_SECRET: z.string().optional(),
  }),
);
