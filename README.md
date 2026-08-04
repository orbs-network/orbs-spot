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
- `crymbo`
- `efficient-frontier`
- `ginco`
- `ht-digital`

## Build

```bash
yarn build
```

## WalletConnect

WalletConnect uses `NEXT_PUBLIC_PROJECT_ID` as the Reown project id. The
current browser domain must be added to that project in Reown Dashboard under
Project Domains, otherwise the WalletConnect modal can show
`Invalid App Configuration`.

For mobile testing, allow the exact origin you open on the phone, for example
the production domain, tunnel domain, or local network host. `NEXT_PUBLIC_APP_URL`
only controls the app metadata sent to wallets; it does not replace Reown's
domain allowlist check.

## Deploy

The manual GitHub Actions workflow `.github/workflows/frontend-deploy.yml`
deploys `default`, `crymbo`, `efficient-frontier`, `ginco`, `ht-digital`, or `all` to Vercel.

Required repository/environment secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_DEFAULT` or fallback `VERCEL_PROJECT_ID`
- `VERCEL_PROJECT_ID_CRYMBO`
- `VERCEL_PROJECT_ID_EFFICIENT_FRONTIER`
- `VERCEL_PROJECT_ID_GINCO`
- `VERCEL_PROJECT_ID_HT_DIGITAL`
- `NEXT_PUBLIC_PROJECT_ID`
- `RPC_URL`
