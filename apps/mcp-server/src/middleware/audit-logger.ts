import type { Logger } from 'pino';
import type { ApiClient } from './api-client.js';

export interface AuditEntry {
  tool_name: string;
  input_params: Record<string, unknown>;
  session_id: string;
  timestamp: string;
}

export class AuditLogger {
  private api: ApiClient;
  private logger: Logger;

  constructor(api: ApiClient, logger: Logger) {
    this.api = api;
    this.logger = logger;
  }

  /**
   * Log a tool invocation to the API activity endpoint.
   * This is fire-and-forget -- errors are logged but do not block execution.
   */
  async logToolCall(entry: AuditEntry): Promise<void> {
    try {
      // Attempt to extract a project_id from the input params for scoped logging
      const projectId = (entry.input_params.project_id as string) ?? null;

      const path = projectId
        ? `/projects/${projectId}/activity`
        : '/activity';

      await this.api.post(path, {
        type: 'mcp_tool_call',
        tool_name: entry.tool_name,
        input_params: entry.input_params,
        session_id: entry.session_id,
        timestamp: entry.timestamp,
      });

      this.logger.debug({ tool: entry.tool_name, session: entry.session_id }, 'Audit log sent');
    } catch (error) {
      // Audit logging should never break the main flow
      this.logger.warn(
        { error, tool: entry.tool_name },
        'Failed to send audit log',
      );
    }
  }
}
