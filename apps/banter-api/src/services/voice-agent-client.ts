import { env } from '../env.js';

export interface SpawnAgentOptions {
  call_id: string;
  mode: string;
  room_name?: string;
  config?: Record<string, unknown>;
}

export interface AgentInfo {
  agent_id: string;
  status: string;
}

export interface AgentsListResponse {
  agents: Record<string, { status: string; mode: string }>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${env.VOICE_AGENT_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Voice agent request failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function spawnAgent(opts: SpawnAgentOptions): Promise<AgentInfo> {
  return request<AgentInfo>('/agents/spawn', {
    method: 'POST',
    body: JSON.stringify({
      call_id: opts.call_id,
      mode: opts.mode,
      room_name: opts.room_name,
      config: opts.config,
    }),
  });
}

export async function despawnAgent(agentId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/agents/${agentId}/despawn`, {
    method: 'POST',
  });
}

export async function listAgents(): Promise<AgentsListResponse> {
  return request<AgentsListResponse>('/agents');
}

export async function healthCheck(): Promise<{ status: string; agents: number }> {
  return request<{ status: string; agents: number }>('/health');
}
