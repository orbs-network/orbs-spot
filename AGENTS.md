<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Spot reference integration

Start with [README.md](README.md) and [examples/spot/README.md](examples/spot/README.md).
For adapting this example to another app, follow [examples/spot/AGENTS.md](examples/spot/AGENTS.md).

## Choose the relevant source

- Standalone SDK calls: `examples/spot/spot-swap.ts` or `examples/spot/advanced-orders.ts`.
- Change example/download behavior: `features/developer-tools/snippets/sdk-flow-examples.ts`, then `yarn examples:generate`. Generated files are checked for drift by `yarn test`.
- Production swap orchestration: `lib/swap/execution.ts`; polling: `lib/swap/settlement.ts`; recovery: `lib/swap/activity.ts`.
- Advanced-order calculation: `components/advanced-order/use-order-form.ts`; execution: `lib/spot/execution.ts`; wallet adapter: `components/advanced-order/hooks.tsx`.
- Client caching/history: `lib/spot/queries.ts`; cancellation: `lib/spot/cancellation.ts`.
- Playground setup and deployment: `docs/playground.md`.

Before changing SDK integration, read `node_modules/@orbs-network/spot-ui/dist/integration-skill/SKILL.md`
and only the references for the affected flow. The bundled manifest records the matching SDK version.
Import SDK code through its public package root. `OrderType` selects the four advanced strategies;
`OrderVariant` describes detailed history modes. Swaps use quotes directly.

Keep wallet sequencing in the host. Preserve reviewed quote identity and minimums, confirmed receipts,
account/chain checks, duplicate guards, and uncertain-submission recovery. Submission means acceptance;
fill tracking uses `client.getOrder`. Keep developer UI behind the existing `@developer-tools` boundary.

## Verify

Use Node/Yarn versions in `package.json`. Run `yarn test`, `yarn typecheck`, `yarn lint`, and `yarn build`.
For flow changes, run `yarn dev` and exercise `/dev` (swaps) or `/dev?tab=twap` (orders) with **Demo**.
The demo does not sign or submit. Keep wallet verification read-only unless live execution is authorized.
