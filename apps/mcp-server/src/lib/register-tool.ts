import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShape, ZodTypeAny, z } from 'zod';

/**
 * Side-channel registry mapping tool name → Zod return schema.
 * MCP SDK v1.x `server.tool()` does not accept an output schema, so we
 * record the return shape here and the schema generator walks this map
 * at build time to emit typed output ports for the Bolt graph editor.
 */
const returnSchemas = new Map<string, ZodTypeAny>();

export interface RegisterToolOptions<TInput extends ZodRawShape, TReturn extends ZodTypeAny> {
  name: string;
  description: string;
  input: TInput;
  returns: TReturn;
  handler: (args: z.infer<z.ZodObject<TInput>>) => Promise<unknown>;
}

export function registerTool<TInput extends ZodRawShape, TReturn extends ZodTypeAny>(
  server: McpServer,
  opts: RegisterToolOptions<TInput, TReturn>,
): void {
  returnSchemas.set(opts.name, opts.returns);
  server.tool(opts.name, opts.description, opts.input, opts.handler as never);
}

export function getReturnSchema(name: string): ZodTypeAny | undefined {
  return returnSchemas.get(name);
}

export function getAllReturnSchemas(): ReadonlyMap<string, ZodTypeAny> {
  return returnSchemas;
}
