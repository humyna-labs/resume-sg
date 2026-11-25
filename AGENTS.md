# resume-sg: map for agents

Built by the factory (humyna-labs/factory). This file is a map; `docs/` is the system of record.

- `feature_list.json`: features and their status. Only the verify stage marks a feature passing.
- `progress.md`: what happened in earlier sessions. Read it first.
- `src/`: application code (Vite, React, TypeScript). `src/contracts/`, `src/security/`,
  `src/templates/` are protected.
- `tests/unit/` (Vitest), `tests/e2e/` (Playwright, keeps screenshots in `test-results/`).
- `public/_headers`: Cloudflare Pages headers, strict CSP. High risk.
- `.factory/factory.yaml`: gates, high-risk paths, retry limit. High risk.
- `ci/workflows/`: workflow sources; the human installs them into `.github/workflows/`.

Commands: `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e`, `pnpm build`.
Deploys: Cloudflare Pages Git integration on merge to main. No Cloudflare credential exists here.
