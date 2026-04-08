// Service catalog — the source of truth for all BigBlueBam services.
// Zero dependencies.

export const SERVICES = [
  { name: 'api', port: 4000, dockerfile: 'apps/api/Dockerfile', required: true, description: 'Main API' },
  { name: 'helpdesk-api', port: 4001, dockerfile: 'apps/helpdesk-api/Dockerfile', required: true, description: 'Helpdesk API' },
  { name: 'banter-api', port: 4002, dockerfile: 'apps/banter-api/Dockerfile', required: true, description: 'Messaging API' },
  { name: 'beacon-api', port: 4004, dockerfile: 'apps/beacon-api/Dockerfile', required: true, description: 'Knowledge Base API' },
  { name: 'brief-api', port: 4005, dockerfile: 'apps/brief-api/Dockerfile', required: true, description: 'Documents API' },
  { name: 'bolt-api', port: 4006, dockerfile: 'apps/bolt-api/Dockerfile', required: true, description: 'Automation API' },
  { name: 'bearing-api', port: 4007, dockerfile: 'apps/bearing-api/Dockerfile', required: true, description: 'Goals & OKRs API' },
  { name: 'mcp-server', port: 3001, dockerfile: 'apps/mcp-server/Dockerfile', required: true, description: 'MCP Protocol Server' },
  { name: 'worker', port: null, dockerfile: 'apps/worker/Dockerfile', required: true, description: 'Background Jobs' },
  { name: 'frontend', port: 80, dockerfile: 'apps/frontend/Dockerfile', required: true, description: 'Web UI (nginx)' },
  { name: 'voice-agent', port: 4003, dockerfile: 'apps/voice-agent/Dockerfile', required: false, description: 'AI Voice Agent' },
];

export const INFRASTRUCTURE = [
  { name: 'postgres', image: 'postgres:16-alpine', port: 5432, required: true, managed: true, description: 'PostgreSQL Database' },
  { name: 'redis', image: 'redis:7-alpine', port: 6379, required: true, managed: true, description: 'Redis Cache & PubSub' },
  { name: 'minio', image: 'minio/minio:latest', port: 9000, required: false, managed: false, description: 'File Storage (S3-compatible)' },
  { name: 'qdrant', image: 'qdrant/qdrant:latest', port: 6333, required: false, managed: false, description: 'Vector Search' },
  { name: 'livekit', image: 'livekit/livekit-server:latest', port: 7880, required: false, managed: false, description: 'Voice/Video Server' },
];

export const APP_URLS = {
  'b3': { label: 'Bam (Project Management)', path: '/b3/' },
  'helpdesk': { label: 'Helpdesk', path: '/helpdesk/' },
  'banter': { label: 'Banter (Messaging)', path: '/banter/' },
  'beacon': { label: 'Beacon (Knowledge Base)', path: '/beacon/' },
  'brief': { label: 'Brief (Documents)', path: '/brief/' },
  'bolt': { label: 'Bolt (Automations)', path: '/bolt/' },
  'bearing': { label: 'Bearing (Goals & OKRs)', path: '/bearing/' },
  'mcp': { label: 'MCP Server', path: '/mcp/' },
};

/**
 * Get all required services.
 */
export function getRequiredServices() {
  return SERVICES.filter((s) => s.required);
}

/**
 * Get all optional services.
 */
export function getOptionalServices() {
  return SERVICES.filter((s) => !s.required);
}

/**
 * Get all required infrastructure.
 */
export function getRequiredInfra() {
  return INFRASTRUCTURE.filter((i) => i.required);
}

/**
 * Get all optional infrastructure.
 */
export function getOptionalInfra() {
  return INFRASTRUCTURE.filter((i) => !i.required);
}
