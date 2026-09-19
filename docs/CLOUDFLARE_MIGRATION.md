# Cloudflare migration

The production Netlify deployment remains untouched until the Worker preview
passes QA. The Worker keeps Upstash for analysis cache, distributed locks, and
rate limiting. D1 holds only account and session records.

## Cloudflare account access

The Codex Cloudflare connection currently has DNS access but not Workers or D1
access. Reconnect it with these least-privilege groups:

- Developer Platform: Workers Scripts, Workers Routes, and D1: Edit
- DNS & Zones: Zone, DNS, and Registrar Domains: Read; Zone DNS: Edit only for
  the final custom-domain cutover

Do not grant Account & Billing, AI, R2, KV, Pages, or broad account-wide write
permissions for this migration.

## First preview deployment

1. Create D1 database `pokepilot` in the Cloudflare dashboard.
2. Copy the database ID into `wrangler.jsonc` as:

   ```jsonc
   "d1_databases": [{
     "binding": "DB",
     "database_name": "pokepilot",
     "database_id": "<database-id>",
     "migrations_dir": "./migrations"
   }]
   ```

3. Apply `npx wrangler d1 migrations apply pokepilot --remote`.
4. Set the documented Worker secrets through the Cloudflare dashboard. Never
   put a secret in `wrangler.jsonc`, `.env.cloudflare`, Git, or chat.
5. Deploy `npm run deploy:cloudflare`. Add its `workers.dev` callback URL to
   the existing Google OAuth web client before using Google sign-in.

## Cutover

After preview QA, add `https://pokepilot.app/api/auth/google/callback` to the
Google OAuth client, map the Cloudflare Worker to `pokepilot.app`, and verify
the production callback plus analysis path. Leave the Netlify site online but
unlinked during the observation period; it is the rollback target.
