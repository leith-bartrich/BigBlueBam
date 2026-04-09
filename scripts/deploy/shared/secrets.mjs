// Secret generation and integration configuration prompts.
// Zero dependencies (node:crypto only, plus local prompt helpers).

import * as crypto from 'node:crypto';
import { ask, askPassword, select, confirm } from './prompt.mjs';
import { bold, dim, check, green, yellow, cyan } from './colors.mjs';

/**
 * Generate a cryptographically random hex string.
 */
function randomHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate all required secrets automatically.
 */
export function generateSecrets() {
  return {
    SESSION_SECRET: randomHex(32),
    INTERNAL_HELPDESK_SECRET: randomHex(32),
    MINIO_ROOT_USER: 'bigbluebam',
    MINIO_ROOT_PASSWORD: randomHex(24),
    POSTGRES_PASSWORD: randomHex(24),
    REDIS_PASSWORD: randomHex(24),
    LIVEKIT_API_KEY: 'API' + randomHex(16),
    LIVEKIT_API_SECRET: randomHex(32),
  };
}

/**
 * Prompt user for file storage choice.
 */
export async function promptStorageChoice() {
  const choice = await select('How should BigBlueBam store uploaded files?', [
    { label: 'Built-in storage (MinIO)', value: 'minio', description: 'Simplest -- included in the install' },
    { label: 'Amazon S3', value: 's3', description: "You'll need an AWS account and S3 bucket" },
    { label: 'Cloudflare R2', value: 'r2', description: "You'll need a Cloudflare account" },
    { label: 'Skip for now', value: 'skip', description: "File uploads won't work" },
  ]);

  const config = { storageProvider: choice };

  if (choice === 's3') {
    console.log(`\n${bold('Amazon S3 Configuration')}\n`);
    config.S3_ENDPOINT = await ask('S3 endpoint (leave blank for default AWS):', '');
    config.S3_ACCESS_KEY = await ask('Access key ID:');
    config.S3_SECRET_KEY = await askPassword('Secret access key:');
    config.S3_BUCKET = await ask('Bucket name:', 'bigbluebam-uploads');
    config.S3_REGION = await ask('Region:', 'us-east-1');
  } else if (choice === 'r2') {
    console.log(`\n${bold('Cloudflare R2 Configuration')}\n`);
    config.S3_ENDPOINT = await ask('R2 endpoint URL:');
    config.S3_ACCESS_KEY = await ask('Access key ID:');
    config.S3_SECRET_KEY = await askPassword('Secret access key:');
    config.S3_BUCKET = await ask('Bucket name:', 'bigbluebam-uploads');
    config.S3_REGION = await ask('Region:', 'auto');
  }

  return config;
}

/**
 * Prompt user for vector DB choice (Qdrant).
 */
export async function promptVectorDbChoice() {
  const choice = await select('Vector search for Beacon knowledge base:', [
    { label: 'Built-in Qdrant', value: 'qdrant-local', description: 'Self-hosted, included in the install' },
    { label: 'Qdrant Cloud', value: 'qdrant-cloud', description: "You'll need a Qdrant Cloud account" },
    { label: 'Skip for now', value: 'skip', description: 'Beacon semantic search will be disabled' },
  ]);

  const config = { vectorProvider: choice };

  if (choice === 'qdrant-cloud') {
    console.log(`\n${bold('Qdrant Cloud Configuration')}\n`);
    config.QDRANT_URL = await ask('Qdrant cluster URL:');
    config.QDRANT_API_KEY = await askPassword('API key:');
  }

  return config;
}

/**
 * Prompt user for LiveKit choice.
 */
export async function promptLiveKitChoice() {
  const choice = await select('Voice/video calling (LiveKit):', [
    { label: 'Built-in LiveKit', value: 'livekit-local', description: 'Self-hosted, included in the install' },
    { label: 'LiveKit Cloud', value: 'livekit-cloud', description: "You'll need a LiveKit Cloud account" },
    { label: 'Skip for now', value: 'skip', description: 'Voice/video features will be disabled' },
  ]);

  const config = { livekitProvider: choice };

  if (choice === 'livekit-cloud') {
    console.log(`\n${bold('LiveKit Cloud Configuration')}\n`);
    config.LIVEKIT_URL = await ask('LiveKit server URL:');
    config.LIVEKIT_API_KEY = await ask('API key:');
    config.LIVEKIT_API_SECRET = await askPassword('API secret:');
  }

  return config;
}

/**
 * Prompt for optional integrations (OAuth, SMTP).
 */
export async function promptOptionalIntegrations() {
  const config = {};

  console.log(`\n${bold('Optional Integrations')}`);
  console.log(dim('You can skip these now and configure them later in the .env file.\n'));

  // SMTP
  if (await confirm('Configure email (SMTP) for notifications?', false)) {
    console.log(`\n${bold('SMTP Configuration')}\n`);
    config.SMTP_HOST = await ask('SMTP host:', 'smtp.gmail.com');
    config.SMTP_PORT = await ask('SMTP port:', '587');
    config.SMTP_USER = await ask('SMTP username/email:');
    config.SMTP_PASS = await askPassword('SMTP password:');
    config.SMTP_FROM = await ask('From address:', config.SMTP_USER || '');
    console.log(`  ${check} SMTP configured`);
  } else {
    console.log(`  ${dim('Skipped SMTP -- email notifications will be disabled')}`);
  }

  // OAuth
  if (await confirm('\nConfigure Google OAuth (SSO login)?', false)) {
    console.log(`\n${bold('Google OAuth Configuration')}\n`);
    config.OAUTH_GOOGLE_CLIENT_ID = await ask('Client ID:');
    config.OAUTH_GOOGLE_CLIENT_SECRET = await askPassword('Client secret:');
    console.log(`  ${check} Google OAuth configured`);
  } else {
    console.log(`  ${dim('Skipped OAuth -- users will log in with email/password')}`);
  }

  // AI / LLM key
  if (await confirm('\nConfigure an AI/LLM API key (for Beacon AI features)?', false)) {
    console.log(`\n${bold('AI Configuration')}\n`);
    const provider = await select('AI provider:', [
      { label: 'OpenAI', value: 'openai' },
      { label: 'Anthropic', value: 'anthropic' },
    ]);
    if (provider === 'openai') {
      config.OPENAI_API_KEY = await askPassword('OpenAI API key:');
    } else {
      config.ANTHROPIC_API_KEY = await askPassword('Anthropic API key:');
    }
    console.log(`  ${check} AI provider configured`);
  } else {
    console.log(`  ${dim('Skipped AI -- AI-powered features will be disabled')}`);
  }

  return config;
}

/**
 * Ask the user what the root domain (/) should show.
 */
export async function promptRootRedirect() {
  console.log(`\n${bold('Homepage')}`);
  console.log(dim('When someone visits your domain root (/), where should they land?\n'));

  const choice = await select('Root page:', [
    { label: 'Marketing Site — product overview, screenshots, documentation', value: 'site' },
    { label: 'Bam — project management board (most common for internal teams)', value: 'b3' },
    { label: 'Helpdesk — customer support portal (for customer-facing deploys)', value: 'helpdesk' },
    { label: 'Beacon — knowledge base', value: 'beacon' },
    { label: 'Brief — collaborative documents', value: 'brief' },
    { label: 'Bolt — workflow automations', value: 'bolt' },
    { label: 'Bearing — goals & OKR tracking', value: 'bearing' },
    { label: 'Board — visual collaboration', value: 'board' },
    { label: 'Banter — team messaging', value: 'banter' },
  ]);

  console.log(`  ${check} Root will show: ${choice === 'site' ? 'Marketing Site' : '/' + choice + '/'}`);
  console.log(dim('  You can change this later in SuperUser settings.\n'));

  return choice;
}

/**
 * Build a complete env config object from all collected choices.
 */
export function buildEnvConfig(choices) {
  const { secrets, storage, vectorDb, livekit, integrations, domain } = choices;

  const env = {
    // Domain
    DOMAIN: domain || 'localhost',
    BASE_URL: domain ? `https://${domain}` : 'http://localhost',

    // Database
    POSTGRES_USER: 'bigbluebam',
    POSTGRES_PASSWORD: secrets.POSTGRES_PASSWORD,
    POSTGRES_DB: 'bigbluebam',
    DATABASE_URL: `postgresql://bigbluebam:${secrets.POSTGRES_PASSWORD}@postgres:5432/bigbluebam`,

    // Redis
    REDIS_PASSWORD: secrets.REDIS_PASSWORD,
    REDIS_URL: `redis://:${secrets.REDIS_PASSWORD}@redis:6379`,

    // Sessions
    SESSION_SECRET: secrets.SESSION_SECRET,
    INTERNAL_HELPDESK_SECRET: secrets.INTERNAL_HELPDESK_SECRET,

    // Node environment
    NODE_ENV: 'production',
  };

  // Storage
  if (storage.storageProvider === 'minio') {
    env.MINIO_ROOT_USER = secrets.MINIO_ROOT_USER;
    env.MINIO_ROOT_PASSWORD = secrets.MINIO_ROOT_PASSWORD;
    env.S3_ENDPOINT = 'http://minio:9000';
    env.S3_ACCESS_KEY = secrets.MINIO_ROOT_USER;
    env.S3_SECRET_KEY = secrets.MINIO_ROOT_PASSWORD;
    env.S3_BUCKET = 'bigbluebam-uploads';
    env.S3_REGION = 'us-east-1';
    env.S3_FORCE_PATH_STYLE = 'true';
  } else if (storage.storageProvider === 's3' || storage.storageProvider === 'r2') {
    if (storage.S3_ENDPOINT) env.S3_ENDPOINT = storage.S3_ENDPOINT;
    env.S3_ACCESS_KEY = storage.S3_ACCESS_KEY;
    env.S3_SECRET_KEY = storage.S3_SECRET_KEY;
    env.S3_BUCKET = storage.S3_BUCKET;
    env.S3_REGION = storage.S3_REGION;
  }

  // Vector DB
  if (vectorDb.vectorProvider === 'qdrant-local') {
    env.QDRANT_URL = 'http://qdrant:6333';
  } else if (vectorDb.vectorProvider === 'qdrant-cloud') {
    env.QDRANT_URL = vectorDb.QDRANT_URL;
    env.QDRANT_API_KEY = vectorDb.QDRANT_API_KEY;
  }

  // LiveKit
  if (livekit.livekitProvider === 'livekit-local') {
    env.LIVEKIT_URL = 'ws://livekit:7880';
    env.LIVEKIT_API_KEY = secrets.LIVEKIT_API_KEY;
    env.LIVEKIT_API_SECRET = secrets.LIVEKIT_API_SECRET;
  } else if (livekit.livekitProvider === 'livekit-cloud') {
    env.LIVEKIT_URL = livekit.LIVEKIT_URL;
    env.LIVEKIT_API_KEY = livekit.LIVEKIT_API_KEY;
    env.LIVEKIT_API_SECRET = livekit.LIVEKIT_API_SECRET;
  }

  // Integrations
  const intKeys = [
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    'OAUTH_GOOGLE_CLIENT_ID', 'OAUTH_GOOGLE_CLIENT_SECRET',
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  ];
  for (const key of intKeys) {
    if (integrations[key]) env[key] = integrations[key];
  }

  return env;
}
