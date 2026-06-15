# Axiom Realty AI Deployment

The permanent fix is to run Axiom on an always-on host, then point a real domain at that host. Do not rely on a Codex `localhost` process as the production website.

## Required Environment Variables

- `PORT` - set by most hosts automatically.
- `HOST=0.0.0.0`
- `PUBLIC_BASE_URL=https://your-domain.com`
- `ALLOWED_ORIGIN=https://your-domain.com`
- `ADMIN_PASSWORD=` a strong private password.
- `OPERATIONS_DEMO_MODE=false` for production.

Optional WhatsApp/email integrations can stay blank until the production provider is chosen.

## Health Check

Use:

```text
/healthz
```

Expected response:

```json
{"ok":true,"service":"axiom-realty-ai","status":"up"}
```

## Generic Node Host

Build command:

```text
npm ci --omit=dev
```

Start command:

```text
node server.js
```

Health check path:

```text
/healthz
```

## Docker Host

Build:

```text
docker build -t axiom-realty-ai .
```

Run:

```text
docker run -p 8080:8080 --env-file .env axiom-realty-ai
```

Then open:

```text
http://127.0.0.1:8080/?admin=1#admin
```
