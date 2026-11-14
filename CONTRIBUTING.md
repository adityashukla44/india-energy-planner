# Contributing

## Workflow

1. Create a branch from `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Make your change, then run:
   ```bash
   npm test
   npm run build
   npm run test:e2e   # optional, for UI changes
   ```
3. Open a pull request into `main` and fill in the template. CI runs unit tests and a full build.
4. The repository owner reviews and merges.

## Conventions

- **Commits:** short, imperative subject line (`Add wind sizing to planner`, `Fix heatmap legend`).
- **Code:** TypeScript everywhere; keep planning maths in `client/src/engine/` pure and tested.
- **Text:** every user-facing string goes through i18next, with keys in all four files under `client/src/i18n/`. The translation test fails if a key or `{{placeholder}}` is missing.
- **Data:** change JSON in `client/public/data/` rather than hard-coding numbers. See [docs/DATA.md](docs/DATA.md).
- **Secrets:** never commit `.env` or API keys.
