import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4007),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  SESSION_SECRET: z.string().min(32),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // Internal service URLs
  MCP_INTERNAL_URL: z.string().default('http://mcp-server:3001'),
  BBB_API_INTERNAL_URL: z.string().default('http://api:4000'),

  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error('Invalid environment variables:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
