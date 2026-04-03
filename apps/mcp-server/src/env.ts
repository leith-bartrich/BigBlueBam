import { z } from 'zod';

const envSchema = z.object({
  MCP_PORT: z.coerce.number().int().positive().default(3001),
  MCP_TRANSPORT: z.enum(['streamable-http', 'stdio', 'sse']).default('streamable-http'),
  API_INTERNAL_URL: z.string().url().default('http://localhost:3000'),
  HELPDESK_API_URL: z.string().url().default('http://localhost:4001'),
  BANTER_API_URL: z.string().url().default('http://localhost:4002'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  MCP_AUTH_REQUIRED: z.coerce.boolean().default(true),
  MCP_RATE_LIMIT_RPM: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return result.data;
}
