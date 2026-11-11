# Using this example as an agent

When the user asks to integrate Spot into another app:

1. Read README.md in this directory and choose the swap or advanced-order `.ts` example. Inspect the target app’s wallet, token registry, quote lifecycle, submit/review UI, and supported chains before editing it.
2. Read the target’s installed `@orbs-network/spot-ui/dist/integration-skill/SKILL.md` and its relevant reference: `07-swap-and-migration.md` for swaps, `02-form-calculation.md` and `03-client-and-execution.md` for advanced orders. Use the installed package’s declarations; the repository’s master branch may differ.
3. Adapt the SDK sequence into the target’s existing services. The example’s Polygon chain, External partner, browser provider, and embedded form values are demonstration configuration. They must come from the target app’s current wallet and reviewed inputs. If a partner/chain is unsupported, surface configuration failure rather than inventing an adapter.
4. Preserve the contracts listed in README.md. Use the reference app’s pure executors to understand guards and recovery; do not copy its entire React tree or introduce a Spot provider for this framework-neutral integration.
5. Run the target’s typecheck/build and relevant tests. Exercise quote loading/error, edited inputs, changed wallet, rejected prompts, refreshed quotes, and status outcomes. Use the reference playground’s Demo for read-only verification; real wallet execution requires the user’s authorization.
6. Report the implemented path, configuration that still needs user input, and checks actually run. An uncertain POST response must be reconciled before another submission.

When maintaining this repository, edit the snippet generator and regenerate the `.ts` files.
Run `yarn test`, `yarn typecheck`, `yarn lint`, and `yarn build`. Keep these instructions and the
guide aligned with the installed SDK instead of adding another competing integration flow.
