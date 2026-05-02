# TicNexus

Multi-tenant franchise management platform built with Next.js 15, PostgreSQL, and Prisma.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+
- A domain name with DNS pointed at your server (for HTTPS)
- A Gmail account with [App Passwords](https://myaccount.google.com/apppasswords) enabled (for email)

---

## Production Deployment

### 1. Clone the repository

```bash
git clone <your-repo-url> ticnexus
cd ticnexus
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in every value:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full PostgreSQL connection string. Must match the `POSTGRES_*` values below. |
| `POSTGRES_USER` | Database username |
| `POSTGRES_PASSWORD` | Database password — use a strong random value |
| `POSTGRES_DB` | Database name |
| `NEXT_PUBLIC_APP_URL` | Full public URL of the app, e.g. `https://app.example.com` |
| `BETTER_AUTH_URL` | Same as `NEXT_PUBLIC_APP_URL` |
| `BETTER_AUTH_SECRET` | Random 32-byte secret. Generate with: `openssl rand -base64 32` |
| `GMAIL_USER` | Gmail address used to send transactional email |
| `GMAIL_APP_PASSWORD` | [Google App Password](https://myaccount.google.com/apppasswords) (not your account password) |

The `DATABASE_URL` must use the Docker Compose service hostname (`db`) as the host:

```
DATABASE_URL="postgresql://ticnexus:yourpassword@db:5432/ticnexus"
```

### 3. Build and start

```bash
docker compose up -d --build
```

This will:
1. Build the Next.js application image
2. Start a PostgreSQL 16 database
3. Run all Prisma migrations automatically on startup
4. Start the app on port `3000`

Check that both containers are healthy:

```bash
docker compose ps
```

### 4. Set up a reverse proxy (HTTPS)

The app listens on `http://localhost:3000`. You must front it with a reverse proxy that terminates TLS before exposing it to the internet.

**Caddy** (simplest — handles certificates automatically):

```caddyfile
app.example.com {
    reverse_proxy localhost:3000
}
```

**Nginx** (example):

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### 5. Complete first-run setup

Visit `https://app.example.com/setup` in your browser to create the initial administrator account. This page is only accessible before any admin user exists.

---

## Useful Commands

**View logs:**

```bash
docker compose logs -f app
docker compose logs -f db
```

**Open a shell in the app container:**

```bash
docker compose exec app sh
```

**Open a PostgreSQL prompt:**

```bash
docker compose exec db psql -U ticnexus -d ticnexus
```

**Run a manual database migration:**

```bash
docker compose exec app node_modules/prisma/build/index.js migrate deploy
```

**Stop the stack:**

```bash
docker compose down
```

**Stop and delete all data (destructive):**

```bash
docker compose down -v
```

---

## Upgrading

```bash
git pull
docker compose up -d --build
```

Migrations run automatically when the container starts. No manual migration step is needed.

---

## Backup and Restore

**Backup the database:**

```bash
docker compose exec db pg_dump -U ticnexus ticnexus > backup-$(date +%Y%m%d).sql
```

**Restore from a backup:**

```bash
docker compose exec -T db psql -U ticnexus -d ticnexus < backup-20260101.sql
```

---

## Troubleshooting

**App fails to start — "database not ready"**

The healthcheck retries for up to 50 seconds. If the database takes longer to initialize on first run, restart the app container:

```bash
docker compose restart app
```

**Migrations fail on startup**

Check the app logs for the specific error:

```bash
docker compose logs app
```

If there is a schema conflict, you may need to resolve the migration manually or reset the database (destructive):

```bash
docker compose down -v
docker compose up -d --build
```

**Emails not sending**

- Confirm `GMAIL_USER` and `GMAIL_APP_PASSWORD` are correct in `.env`
- App Passwords require 2-Step Verification to be enabled on the Google account
- App Passwords are 16 characters with spaces, e.g. `xxxx xxxx xxxx xxxx`

**Session / auth errors after deploying**

If you rotated `BETTER_AUTH_SECRET`, existing sessions are invalidated. Users will need to log in again. This is expected behavior.