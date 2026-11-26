# Netlify fallback for Spot

Use this procedure only if the shared Netlify hosting skill cannot be accessed. Follow the parent skill for the rest of the launch.

## Publish to Netlify

Only after design approval (unless design decisions were delegated) and only if publication was requested. Use another provider if the user chose one, applying the same rules.

1. **Account and cost.** Help the user create or sign in to their own Netlify account in their browser; the agent handles any CLI login initiation. Check [current Netlify pricing](https://www.netlify.com/pricing/) and the account's actual plan, limits and overage/pause behavior. Explain material costs in one or two sentences. If terms or costs can't be verified, stop at a ready local build and report publication pending.
2. **Site.** Reuse a site from `DEPLOYMENT.md` or an existing link after verifying its account, team and site ID. Otherwise choose an available `name.netlify.app` address based on the app name unless the user supplied a preference, and create one site. Never deploy through a script or link that belongs to someone else's project. The agent handles setup and configuration; ask the user only for account access or necessary decisions they must make.
3. **Build settings.** Use Netlify's [Next.js runtime](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) so route handlers deploy as functions — never a static export, `dist/` upload or SPA catch-all. Confirm Netlify supports the installed Next.js version. If no `netlify.toml` exists, add a minimal one:

   ```toml
   [build]
     command = "yarn build"
     publish = ".next"
   ```

   Netlify reads `.nvmrc` for Node; set `YARN_VERSION=1.22.22` in site environment variables.
4. **Environment.** `.env.local` is not uploaded and does not configure the site. Set every value from step 2 in Netlify's site environment for the production and deploy-preview contexts, with build **and** functions scopes (`APP_*` values are needed at runtime too). Mark `RPC_URL`/`RPC_URLS` as secret. See Netlify's [framework environment guide](https://docs.netlify.com/build/frameworks/use-environment-variables-with-frameworks/).
5. **Rate limiting.** `/api/rpc`, `/api/balances` and `/api/transaction-receipt` spend the partner's RPC quota. Configure and verify a shared per-client rate limit for them using the host or a WAF. The app's `RPC_RATE_LIMIT_PER_MINUTE` (default 600) is per instance and is not a distributed limit. If shared protection is unavailable, finish the local build and draft where feasible, explain the remaining exposure and possible quota costs, and ask the user how to proceed before production publication. Record any explicit decision to proceed without it.
6. **Draft, then production.** Check the current Netlify CLI documentation and use its framework-aware build and deployment workflow with the intended build environment and context. Confirm the generated deployment includes the Next.js route handlers as functions. Deploy a draft and verify it (step 6), then publish the reviewed source and settings to production. If source, build output, or relevant settings differ, rebuild and repeat the affected checks.

