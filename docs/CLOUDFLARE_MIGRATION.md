# Cloudflare migration

Status: complete as of 2026-09-18. `https://pokepilot.app` is served by the
`pokepilot` Cloudflare Worker. The Worker serves the built Vite assets and owns
the API, Google OAuth callback, and same-origin Smogon proxy.

## Current production topology

- **Worker and static assets:** `pokepilot` Worker with the `ASSETS` binding
- **Custom domain:** `pokepilot.app`
- **Preview URL:** `https://pokepilot.pokepilot-ai.workers.dev`
- **QA version URL:** `https://qa-pokepilot.pokepilot-ai.workers.dev`
- **QA database:** `pokepilot-qa`, configured in `wrangler.qa.jsonc`
- **Database:** Cloudflare D1 database `pokepilot`, bound as `DB`
- **Operational state:** Upstash Redis for analysis cache, distributed leases,
  cooldowns, and rate limits
- **Account storage:** D1 `accounts`, `account_sessions`, and
  `account_storage` tables

Legacy Netlify/Vercel deployment entry points and Netlify Identity dependencies
have been removed. Their historical implementations remain available in Git.
The Node API adapter in `server/` is still used by the Vite development server.

## Reprovisioning or recovery

1. Confirm `wrangler.jsonc` still binds `ASSETS` and the D1 `DB` database, and
   maps the `pokepilot.app` custom domain.
2. Apply all checked-in D1 migrations in order:

   ```bash
   npx wrangler d1 migrations apply pokepilot --remote
   ```

   If local Wrangler credentials lack D1 access, apply the same checked-in SQL
   through the Cloudflare D1 console and record the operation before deploying.
3. Set server-side Worker secrets in Cloudflare. Never place them in
   `wrangler.jsonc`, `.env.cloudflare`, Git, or chat:

   - `OPENAI_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `POKEPILOT_CLIENT_SECRET`
   - `POKEPILOT_SESSION_SECRET`
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
4. Keep the Worker variables in `wrangler.jsonc` aligned with the intended
   environment. Production currently requires account authentication and the
   shared Redis store.
5. In Google Cloud, register the exact production redirect URI:

   ```text
   https://pokepilot.app/api/auth/google/callback
   ```

   Add the `workers.dev` callback only when actively testing that preview host.
6. Verify and deploy:

   ```bash
   npm run check:cloudflare
   npm run deploy:cloudflare
   ```

## QA version URL

`wrangler.qa.jsonc` binds an isolated D1 database and Redis prefix. It uploads
the current build as an aliased Worker version, without deploying that version
to `pokepilot.app`:

```bash
npx wrangler d1 migrations apply pokepilot-qa --remote --config wrangler.qa.jsonc
npm run check:cloudflare
npx wrangler versions upload --config wrangler.qa.jsonc --preview-alias qa
```

The QA version reuses the Worker's existing encrypted secrets. Google sign-in
requires `https://qa-pokepilot.pokepilot-ai.workers.dev/api/auth/google/callback`
in the OAuth client's authorized redirect URIs. The QA database is separate
from production; do not use this config with `wrangler deploy` or `wrangler
versions deploy`.

## Rollback

Use the Cloudflare Workers dashboard to roll the `pokepilot` Worker back to a
previous healthy version. Do not make a DNS or registrar change for an ordinary
application rollback. After rollback, verify `/`, `/api/pokepilot/account`, a
signed-in PokePilot request, and the Google callback before announcing recovery.
