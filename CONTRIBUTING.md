# Contributing to Invariance CLI

Thanks for your interest in contributing!

## Getting started

1. Fork the repository
2. Clone your fork and install dependencies:
   ```bash
   pnpm install
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```

## Development

```bash
pnpm dev       # Watch mode
pnpm build     # Production build
pnpm test      # Run tests
pnpm lint      # Lint
pnpm typecheck # Type-check
```

## Pull requests

- All tests must pass
- Add a changeset for user-facing changes: `pnpm changeset`
- Keep PRs focused on a single change
- Fill out the PR template

## Changesets

We use [changesets](https://github.com/changesets/changesets) for versioning. If your PR includes a user-facing change, run:

```bash
pnpm changeset
```

Select the appropriate semver bump and write a short summary.

## Code style

- TypeScript strict mode
- Prettier for formatting (`pnpm format`)
- ESLint for linting (`pnpm lint`)
