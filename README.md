# White-Label Swap UI

Next.js trading app with partner-driven branding, styles, metadata, and deploy targets.

## Development

Run from the repository root:

```bash
yarn dev
```

The app runs on [http://localhost:3007](http://localhost:3007).

White-label styling is selected with `NEXT_PARTNER`.

Supported values:

- `default`
- `efficient-frontier`
- `ht-digital`

## Build

```bash
yarn build
```

## Deploy

The manual GitHub Actions workflow `.github/workflows/frontend-deploy.yml`
deploys `default`, `efficient-frontier`, `ht-digital`, or `all` to Vercel.

Required repository/environment secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_DEFAULT` or fallback `VERCEL_PROJECT_ID`
- `VERCEL_PROJECT_ID_EFFICIENT_FRONTIER`
- `VERCEL_PROJECT_ID_HT_DIGITAL`
- `NEXT_PUBLIC_PROJECT_ID`
- `RPC_URL`
