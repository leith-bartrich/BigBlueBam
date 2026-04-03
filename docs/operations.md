# Operations Guide

This guide covers deploying BigBlueBam in production, performing updates without data loss, backups, and common maintenance tasks.

## Deployment Overview

BigBlueBam uses Docker named volumes to persist all data. Application containers (api, banter-api, frontend, worker, mcp-server, helpdesk-api, voice-agent) are **stateless** — they can be rebuilt, replaced, or scaled without affecting data. All three SPAs (BigBlueBam, Banter, Helpdesk) are served from a single nginx container on port 80. Data lives exclusively in three volumes:

| Volume | Service | Contains |
|--------|---------|----------|
| `pgdata` | PostgreSQL | All database tables, users, tasks, tickets, settings |
| `redisdata` | Redis | Session cache, PubSub state, job queues |
| `miniodata` | MinIO | Uploaded files, images, attachments |

**The golden rule:** Never run `docker compose down -v` in production. The `-v` flag deletes volumes and all data. Use `docker compose down` (without `-v`) to stop services while preserving data.

---

## First-Time Deployment

```bash
# 1. Clone the repo
git clone https://github.com/eoffermann/BigBlueBam.git
cd BigBlueBam

# 2. Configure environment
cp .env.example .env
```

Edit `.env` with production values:

```bash
# REQUIRED — change these from defaults
POSTGRES_USER=bigbluebam
POSTGRES_PASSWORD=<generate-strong-password>
REDIS_PASSWORD=<generate-strong-password>
MINIO_ROOT_USER=bigbluebam
MINIO_ROOT_PASSWORD=<generate-strong-password>
SESSION_SECRET=<generate-with: openssl rand -hex 32>

# OPTIONAL — adjust as needed
# API_PORT=4000
# HTTP_PORT=80
# (Helpdesk is served at /helpdesk/ on port 80)
# LOG_LEVEL=info
```

```bash
# 3. Start all services
docker compose up -d

# 4. Wait for health checks to pass
docker compose ps
# All services should show "healthy" or "Up"

# 5. Create your admin account
docker compose exec api node dist/cli.js create-admin \
  --email admin@yourcompany.com \
  --password YourSecurePassword123 \
  --name "Admin User" \
  --org "Your Organization"

# 6. Configure helpdesk (optional)
# Log in at http://localhost/b3/, go to Settings > Helpdesk
# Set default project and phase for new tickets
```

---

## Updating BigBlueBam

Updates are safe because application containers are stateless. Data volumes are never touched during an update.

### Standard Update Procedure

```bash
# 1. Pull the latest code
cd BigBlueBam
git pull origin main

# 2. Rebuild all application images
docker compose build

# 3. Rolling restart — replace containers one at a time
#    Data services (postgres, redis, minio) are NOT restarted
docker compose up -d --force-recreate --no-deps api
docker compose up -d --force-recreate --no-deps worker
docker compose up -d --force-recreate --no-deps mcp-server
docker compose up -d --force-recreate --no-deps helpdesk-api
docker compose up -d --force-recreate --no-deps frontend

# 4. Verify all services are healthy
docker compose ps
```

### If Database Schema Changed

When an update includes new tables or columns (check the release notes or `infra/postgres/init.sql` diff), you need to apply migrations. Since BigBlueBam uses `init.sql` for schema (applied on first database creation), schema updates for existing deployments need to be applied manually:

```bash
# Check what changed in the schema
git diff HEAD~1 infra/postgres/init.sql

# Apply new tables/columns via psql
# Example: if a new table was added
docker compose exec postgres psql -U bigbluebam -c "
  CREATE TABLE IF NOT EXISTS new_table (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
  );
"

# Or run a migration SQL file if provided
docker compose exec -T postgres psql -U bigbluebam < migrations/001-add-new-table.sql
```

### Quick Update (When You Know Nothing Changed in the Schema)

```bash
git pull origin main
docker compose build
docker compose up -d --force-recreate
```

This rebuilds all images and replaces all containers. Data volumes are untouched.

---

## Backups

### Database Backup

```bash
# Create a SQL dump
docker compose exec -T postgres pg_dump -U bigbluebam bigbluebam > backup-$(date +%Y%m%d-%H%M%S).sql

# Compressed backup
docker compose exec -T postgres pg_dump -U bigbluebam bigbluebam | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

### Database Restore

```bash
# Stop the API to prevent writes during restore
docker compose stop api worker helpdesk-api

# Restore from backup
docker compose exec -T postgres psql -U bigbluebam bigbluebam < backup-20260403-120000.sql

# Restart services
docker compose start api worker helpdesk-api
```

### MinIO (File Uploads) Backup

```bash
# Install mc (MinIO client) if not already available
# Or use the MinIO container's built-in mc

# Backup all uploaded files
docker run --rm --network bigbluebam_backend \
  -v $(pwd)/minio-backup:/backup \
  minio/mc sh -c "
    mc alias set local http://minio:9000 minioadmin \$(cat /run/secrets/minio_password) &&
    mc mirror local/bigbluebam-uploads /backup/
  "

# Or simpler — copy the Docker volume directly
docker run --rm \
  -v bigbluebam_miniodata:/data \
  -v $(pwd)/minio-backup:/backup \
  alpine tar czf /backup/minio-$(date +%Y%m%d).tar.gz -C /data .
```

### Full Backup Script

Save this as `backup.sh`:

```bash
#!/bin/bash
set -e
BACKUP_DIR="./backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Backing up PostgreSQL..."
docker compose exec -T postgres pg_dump -U bigbluebam bigbluebam | gzip > "$BACKUP_DIR/postgres.sql.gz"

echo "Backing up MinIO..."
docker run --rm \
  -v bigbluebam_miniodata:/data \
  -v "$(pwd)/$BACKUP_DIR":/backup \
  alpine tar czf /backup/minio.tar.gz -C /data .

echo "Backing up Redis..."
docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD:-changeme}" BGSAVE
sleep 2
docker run --rm \
  -v bigbluebam_redisdata:/data \
  -v "$(pwd)/$BACKUP_DIR":/backup \
  alpine cp /data/dump.rdb /backup/redis.rdb

echo "Backup complete: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
```

### Automated Backups

Add a cron job for daily backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/BigBlueBam && ./backup.sh >> /var/log/bigbluebam-backup.log 2>&1
```

---

## Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f helpdesk-api

# Last 100 lines
docker compose logs --tail=100 api
```

### Restart a Single Service

```bash
# Restart without rebuilding (e.g., after config change)
docker compose restart api

# Rebuild and restart (after code change)
docker compose build api
docker compose up -d --force-recreate --no-deps api
```

### Check Service Health

```bash
# All services
docker compose ps

# API health (via nginx)
curl http://localhost/b3/api/health
curl http://localhost/b3/api/health/ready

# MCP server health (via nginx)
curl http://localhost/mcp/health

# Helpdesk API (via nginx)
curl http://localhost/helpdesk/api/health
```

### Access the Database Directly

```bash
# Interactive psql session
docker compose exec postgres psql -U bigbluebam

# Run a query
docker compose exec postgres psql -U bigbluebam -c "SELECT count(*) FROM tasks;"

# Check table sizes
docker compose exec postgres psql -U bigbluebam -c "
  SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid))
  FROM pg_catalog.pg_statio_user_tables
  ORDER BY pg_total_relation_size(relid) DESC
  LIMIT 20;
"
```

### Create Additional Admin Users

```bash
docker compose exec api node dist/cli.js create-admin \
  --email newadmin@yourcompany.com \
  --password SecurePassword123 \
  --name "New Admin" \
  --org "Your Organization"
```

### Reset a User's Password

```bash
docker compose exec api node -e "
  const argon2 = require('argon2');
  const postgres = require('postgres');
  (async () => {
    const sql = postgres(process.env.DATABASE_URL);
    const hash = await argon2.hash('NewPassword123');
    await sql\`UPDATE users SET password_hash = \${hash} WHERE email = 'user@example.com'\`;
    console.log('Password updated');
    await sql.end();
  })();
"
```

---

## Scaling

### Vertical Scaling (Single Machine)

Increase resources for data services in `docker-compose.yml`:

```yaml
postgres:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
```

### Horizontal Scaling (Multiple API Instances)

The API is stateless — run multiple instances behind nginx:

```yaml
api:
  deploy:
    replicas: 3
```

WebSocket connections work across instances because events are broadcast via Redis PubSub.

---

## Troubleshooting

### 502 Bad Gateway After Update

Nginx caches DNS for upstream containers. After rebuilding, restart the nginx containers:

```bash
docker compose restart frontend
```

### "Session Expired" on Login

- Check that the API is running: `curl http://localhost/b3/api/health`
- If the database was recreated, previous accounts no longer exist — register a new account
- Clear browser cookies and try again

### File Uploads Return 404

- Ensure MinIO is running: `docker compose ps minio`
- Check the API can reach MinIO: `docker compose logs api | grep -i minio`
- Verify the nginx config correctly proxies `/files/` to MinIO

### Helpdesk Settings Don't Save

- Ensure you're logged into BBB (not the helpdesk portal) when configuring
- The settings endpoint requires a BBB admin session

---

## Environment Variables Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `POSTGRES_USER` | — | Yes | Database username |
| `POSTGRES_PASSWORD` | — | Yes | Database password |
| `REDIS_PASSWORD` | — | Yes | Redis password |
| `MINIO_ROOT_USER` | minioadmin | Yes | MinIO access key |
| `MINIO_ROOT_PASSWORD` | — | Yes | MinIO secret key |
| `SESSION_SECRET` | — | Yes | 32+ char secret for session signing |
| `API_PORT` | 4000 | No | API server internal port |
| `HTTP_PORT` | 80 | No | Single nginx port serving BBB + Helpdesk + MCP |
| `MCP_PORT` | 3001 | No | MCP server internal port |
| `LOG_LEVEL` | info | No | Log verbosity (debug, info, warn, error) |
| `WORKER_CONCURRENCY` | 5 | No | Background job worker threads |
| `CORS_ORIGIN` | http://localhost | No | Allowed CORS origin |
| `SMTP_HOST` | — | No | SMTP server for email notifications |
| `SMTP_PORT` | 587 | No | SMTP port |
| `SMTP_USER` | — | No | SMTP username |
| `SMTP_PASS` | — | No | SMTP password |
| `SMTP_FROM` | noreply@bigbluebam.io | No | Email sender address |
