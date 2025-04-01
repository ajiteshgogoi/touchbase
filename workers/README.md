# Touchbase Workers

This directory contains Cloudflare Workers that handle various proxy and authentication tasks for Touchbase.

## Project Structure

```
workers/
├── touchbase-oauth/      # OAuth token exchange worker
│   ├── worker.ts         # Worker implementation
│   └── wrangler.toml     # Worker-specific configuration
│
├── touchbase-proxy/      # Supabase API proxy worker
│   ├── worker.ts         # Worker implementation
│   └── wrangler.toml     # Worker-specific configuration
│
├── package.json          # Shared dependencies and scripts
└── tsconfig.json         # Shared TypeScript configuration
```

## Workers

### Touchbase OAuth (oauth.touchbase.site)
- Handles secure token exchange for Google OAuth
- Protects client secrets
- Custom domain setup to maintain branding
- Environment variables needed:
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  - WORKER_API_KEY

### Touchbase Proxy (api.touchbase.site)
- Proxies requests to Supabase
- Handles caching and security
- Environment variables needed:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - CLIENT_SECRET

## Development

1. Install dependencies:
```bash
npm install
```

2. Set required secrets for each worker:
```bash
# OAuth Worker
npx wrangler secret put GOOGLE_CLIENT_ID --config touchbase-oauth/wrangler.toml
npx wrangler secret put GOOGLE_CLIENT_SECRET --config touchbase-oauth/wrangler.toml
npx wrangler secret put WORKER_API_KEY --config touchbase-oauth/wrangler.toml

# Proxy Worker
npx wrangler secret put SUPABASE_URL --config touchbase-proxy/wrangler.toml
npx wrangler secret put SUPABASE_ANON_KEY --config touchbase-proxy/wrangler.toml
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config touchbase-proxy/wrangler.toml
npx wrangler secret put CLIENT_SECRET --config touchbase-proxy/wrangler.toml
```

## Deployment

Deploy individual workers:
```bash
npm run deploy:oauth      # Deploy OAuth worker
npm run deploy:supabase  # Deploy Supabase proxy
```

Or deploy all workers:
```bash
npm run deploy:all
```

## Custom Domains

The workers are set up with custom domains:
- OAuth Worker: oauth.touchbase.site
- Proxy Worker: api.touchbase.site

These domains need to be configured in the Cloudflare Dashboard with the appropriate DNS records.