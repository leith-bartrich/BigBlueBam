# BigBlueBam Deployment Guide

Deploy BigBlueBam from zero to running in about 10 minutes. No IT department required.

---

## What You'll Need

Before you start, here's what the setup wizard will configure for you:

- **A place to run it** — any machine with Docker, or a Railway account for managed cloud
- **A database** — PostgreSQL and Redis, automatically provisioned
- **An admin account** — you'll create this during setup
- **Optional**: file storage (S3/MinIO), AI features (Anthropic/OpenAI), voice/video (LiveKit)

## Choose Your Deployment

### Option 1: Docker Compose (Recommended)

Run on any machine with Docker. The fastest path to a running stack today, and the path most teams use for both local development and production self-hosted deployments.

- Works on Linux, macOS, Windows
- All 22 services run with one `docker compose up -d`
- Full control over data and configuration
- Migrations apply automatically before app services start
- Requires Docker Desktop or Docker Engine

### Option 2: Railway (Managed cloud)

Cloud-hosted, managed containers with managed PostgreSQL and Redis. Best for teams that want to skip server administration. The deploy script handles everything: it creates the Railway project, prompts you to add the managed Postgres and Redis plugins (one click each in the dashboard — the only manual step), then walks the service catalog and creates all 19 services via Railway's public GraphQL API, configures each one's source repo, Dockerfile, healthcheck, and environment variables, and triggers the initial deploys. Total time: about 5–10 minutes from `./scripts/deploy.sh` to a running stack.

---

## Step-by-Step Setup

### Step 1: Clone the repository

```bash
git clone https://github.com/eoffermann/BigBlueBam.git
cd BigBlueBam
```

### Step 2: Launch the deploy script

The script checks for Node.js and Docker, installing them if needed.

**Linux / macOS:**
```bash
./scripts/deploy.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\deploy.ps1
```

**Windows (Command Prompt):**
```batch
scripts\deploy.bat
```

> **Note:** Docker is required for the recommended Docker Compose path. The Railway option runs entirely in the cloud and doesn't need Docker locally.

### Step 3: Pick your platform

The script presents an interactive menu:

```
Where are you deploying?

  1. Docker Compose — Run locally or on any server with Docker (recommended)
  2. Railway — Managed cloud containers, fully automated
```

### Step 4: Configure your services

The script auto-generates secure passwords and asks a few simple questions:

```
How should BigBlueBam store uploaded files?

  1. Built-in storage (MinIO — simplest, included in the install)
  2. Amazon S3 (you'll need an AWS account)
  3. Cloudflare R2 (you'll need a Cloudflare account)
  4. Skip for now (file uploads won't work)
```

Similar prompts for vector search (Beacon knowledge base) and voice/video (Banter calls). Most teams just press Enter for the defaults — you can change everything later.

### Step 5: Deploy

- **Docker Compose**: Builds all containers locally, starts everything with `docker compose up`. Migrations run automatically before app services start.
- **Railway**: Logs in to your Railway account, creates the project, provisions managed PostgreSQL + Redis, then creates all 19 services via Railway's GraphQL API — setting source repo, Dockerfile, healthcheck, and environment variables on each, and triggering the initial deploys.

This takes 3–5 minutes on first run for Docker Compose; the Railway path runs unattended after you generate a Personal Access Token and click two buttons to add the managed Postgres and Redis plugins.

### Step 6: Create your admin account

```
Let's create your admin account.

Email address: you@yourcompany.com

Password:
  1. Generate a strong password for me (recommended)
  2. I'll type my own password
> 1

  Your generated password:

    Falcon-Copper-Ribbon-Sage42!

  ⚠  Copy this now — it will not be shown again.

  ✓ Password saved to macOS Keychain
    Service: "BigBlueBam"  Account: "you@yourcompany.com"

Your name: Jane Smith
Organization: Acme Corp

Creating account... ✓
Verifying login... ✓
```

The generated password uses a memorable word-based format that is both strong and easy to read. On macOS, Windows, and Linux desktops, the script can automatically save it to your system keychain.

> **Important:** This is a SuperUser account with full access to everything — all organizations, all settings, all data. Keep the password secure.

### Step 7: You're live!

```
BigBlueBam is running!

  Bam (Projects):     https://your-domain/b3/
  Helpdesk:           https://your-domain/helpdesk/
  Banter (Messaging): https://your-domain/banter/
  Beacon (Knowledge): https://your-domain/beacon/
  Brief (Documents):  https://your-domain/brief/
  Bolt (Automations): https://your-domain/bolt/
  Bearing (Goals):    https://your-domain/bearing/
  MCP Server:         https://your-domain/mcp/
```

---

## After Deployment

### Set up a custom domain

Configure your domain in the Railway dashboard or point your DNS to your server's IP address. BigBlueBam handles all routing through a single nginx reverse proxy on port 80.

### Configure AI providers

Go to **Settings → AI Providers** in the Bam admin panel. Add credentials for Anthropic, OpenAI, or any OpenAI API-compatible endpoint. This enables AI features across the suite, including Bolt's AI-assisted automation authoring.

### Invite your team

Create user accounts from the **People** page in Bam. Assign roles (Member, Admin, Owner) and add users to projects.

### Import existing data

BigBlueBam supports importing from CSV, Trello, Jira, and GitHub Issues. Use the import tools in **Settings → Integrations**.

### Set up email notifications

Configure SMTP settings in your environment variables or through the deploy script's reconfigure option:

```bash
./scripts/deploy.sh --reconfigure
```

---

## What's Running

BigBlueBam consists of 22 services, all managed through Docker Compose. The
authoritative service catalog lives at `scripts/deploy/shared/services.mjs` —
that's also what generates the per-service Railway manifests under `railway/`.

### Application Services

| Service | Port | Description |
|---------|------|-------------|
| api | 4000 | Main Bam API — tasks, sprints, boards, auth |
| helpdesk-api | 4001 | Helpdesk API — tickets, replies, SLAs, public portal |
| banter-api | 4002 | Banter API — messaging, channels, DMs, calls |
| beacon-api | 4004 | Beacon API — knowledge base, vector search, policies |
| brief-api | 4005 | Brief API — collaborative documents, templates |
| bolt-api | 4006 | Bolt API — automation engine, rules, executions |
| bearing-api | 4007 | Bearing API — goals, key results, progress |
| board-api | 4008 | Board API — whiteboards, real-time collab |
| bond-api | 4009 | Bond API — CRM contacts, companies, deals |
| blast-api | 4010 | Blast API — email campaigns, templates, tracking |
| bench-api | 4011 | Bench API — analytics, dashboards, widgets |
| book-api | 4012 | Book API — calendar events, booking pages |
| blank-api | 4013 | Blank API — forms, submissions, public portal |
| bill-api | 4014 | Bill API — invoices, payments, expenses |
| mcp-server | 3001 | MCP protocol server (~270 AI tools) |
| worker | — | Background job processor (BullMQ) |
| voice-agent | 4003 | AI voice agent (Python/FastAPI) |
| frontend | 80 | nginx reverse proxy serving all SPAs |
| site | 3000 | Marketing website (proxied at `/` by frontend) |

### Infrastructure Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Primary database (managed on Railway) |
| Redis | 6379 | Cache, sessions, PubSub, job queues (managed on Railway) |
| MinIO | 9000 | S3-compatible file storage |
| Qdrant | 6333 | Vector search for semantic retrieval |
| LiveKit | 7880 | WebRTC server for voice/video |

---

## Environment Variables

Key environment variables (auto-generated by the deploy script):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Session encryption key (32+ chars) |
| `INTERNAL_HELPDESK_SECRET` | Shared secret between Helpdesk and Bam APIs |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | S3 storage credentials |
| `CORS_ORIGIN` | Allowed origins for CORS |

Optional:

| Variable | Description |
|----------|-------------|
| `OAUTH_GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth credentials |
| `OAUTH_GITHUB_CLIENT_ID` / `SECRET` | GitHub OAuth credentials |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email notification settings |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit voice/video credentials |
| `QDRANT_URL` / `QDRANT_API_KEY` | Qdrant vector database connection |

---

## Updating

**The recommended way to update is to re-run the deploy script.** It detects the existing installation, pulls the latest code, forces a `--no-cache` rebuild of the API image (so new migration files can't be lost to stale build cache or WSL2 file sync), runs the database migrations explicitly, and restarts services:

```bash
./scripts/deploy.sh  # or deploy.ps1 on Windows
```

That's it — you don't need to `git pull` first; the script will offer to do it for you and report how many commits you're behind.

### Updating manually

If you'd rather drive the update by hand, the sequence below matches what the deploy script does and avoids two traps that have bitten the project in the past (see [Migration failures](#migration-failures) for context):

```bash
# 1. Pull the new code
git pull origin main

# 2. Force a no-cache rebuild of the api image
#    (defeats stale build cache that can drop new migration files silently)
docker compose build --no-cache api

# 3. Run migrations explicitly
#    (the migrate sidecar is cached via service_completed_successfully
#     and will NOT re-run on a plain `up -d`, even with new migrations)
docker compose up -d postgres
docker compose run --rm migrate

# 4. Bring everything back up
docker compose up -d --build
```

You can verify the migration actually shipped:

```bash
# Confirm the file is in the image
docker compose run --rm migrate sh -c "ls /app/migrations | tail -5"

# Confirm the column/table exists in the live DB
docker compose exec postgres psql -U bigbluebam -d bigbluebam -c "\d <table_name>"
```

> **Important:** Never run `docker compose down -v` — the `-v` flag destroys all persistent data (database, uploads, cache). Use `docker compose down` (without `-v`) to stop services safely.

---

## Troubleshooting

### Services won't start

Check logs for the failing service:
```bash
docker compose logs -f api          # Main API
docker compose logs -f frontend     # nginx / web UI
docker compose logs -f bolt-api     # Automations
```

### Port conflicts

If port 80 is already in use, set a custom port:
```bash
HTTP_PORT=8080 docker compose up -d
```

### Migration failures

If a migration fails, check the error in the migrate service logs:
```bash
docker compose logs migrate
```

Never edit an existing migration file — the runner tracks SHA-256 checksums and will abort on mismatch.

**"Column does not exist" errors after an update.** If an API service logs `PostgresError: column "X" does not exist` (SQLSTATE `42703`) after an update, the migration file either didn't make it into the rebuilt image or the cached `migrate` sidecar didn't re-run. Re-run the update with the deploy script (`./scripts/deploy.sh`), which forces both a no-cache image rebuild and an explicit migrate invocation.

**Bulletproof fallback** if Docker's build cache or WSL2 file sync refuses to pick up a new migration file, apply it directly:

```bash
# Apply the migration SQL against the running postgres container
cat infra/postgres/migrations/NNNN_new_migration.sql \
  | docker compose exec -T postgres psql -U bigbluebam -d bigbluebam

# Record it in schema_migrations so a future clean boot skips it
docker compose exec -T postgres psql -U bigbluebam -d bigbluebam -c \
  "INSERT INTO schema_migrations (id, checksum) VALUES ('NNNN_new_migration.sql', 'manual') ON CONFLICT (id) DO NOTHING;"
```

### Health check failures

Each API service has a `/health` endpoint. Check individual services:
```bash
curl http://localhost:4000/health    # Main API
curl http://localhost:4004/health    # Beacon
curl http://localhost:4006/health    # Bolt
```

### Reset everything

To start completely fresh (⚠️ this destroys all data):
```bash
docker compose down -v
./scripts/deploy.sh --reset
```

---

## FAQ

**How does the Railway deploy work?**
The deploy script's Railway path uses Railway's public GraphQL API to provision and configure every service in the stack. You generate a Personal Access Token at https://railway.com/account/tokens, paste it into the script, and it handles the rest: project creation, service creation (linked to the GitHub repo), per-service Dockerfile + healthcheck + environment variable configuration, and triggering the initial deploys. The only manual step is clicking "Add Postgres" and "Add Redis" in the Railway dashboard once, because Railway's public API doesn't expose plugin creation. Total run time: about 5–10 minutes from start to all services queued.

**How much will Railway cost?**
Railway offers a free Starter plan that includes $5 of usage per month. With 19 services + managed Postgres + Redis, expect to land in the Developer plan ($5/month + usage). Most small teams spend $20–40/month total once everything's running.

**Can I migrate between Railway and self-hosted?**
Yes — in either direction. Export your database with `pg_dump`, set up Docker Compose (or Railway) on the destination, import the dump, and update your DNS. The application code is identical.

**Can I use BigBlueBam without Docker?**
While Docker Compose is the recommended deployment, you can run each service natively with Node.js 22, PostgreSQL 16, Redis 7, and nginx. You would configure each service manually.

**What browsers are supported?**
All modern browsers: Chrome, Firefox, Safari, Edge. The UI uses React 19 with TailwindCSS and requires JavaScript enabled.

**How do I back up my data?**
Back up the PostgreSQL database with `pg_dump` and the MinIO data directory. For Docker Compose, the data is in named volumes (`pgdata`, `redisdata`, `miniodata`, `qdrantdata`).
