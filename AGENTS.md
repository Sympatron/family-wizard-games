# Development instructions — family-wizard-games

This repository is independent of `Sympatron/family-wizard`. Do not apply the main application's Python/Docker/release-version workflow to standalone games. Read the current `README.md` and these instructions before making changes.

- Use a branch and a focused PR; squash-merge completed PRs only when the PR is mergeable and all required checks have passed. Check GitHub Pages deployment after merging. Report blockers rather than assuming that creating a PR publishes a game.
- Optimize the feedback cycle. GitHub Actions runs only `npm run build` for PRs; pushes to `main` or `dev` deploy static pages. Do not add a full automated test suite, linting gate, Docker or network backend without an explicit request.
- Keep each game under `games/<id>/` with `game.json` and `index.html`. The launcher is generated from manifests. Shared code belongs in `shared/`; avoid coupling separate games.
- Native JavaScript modules and zero-dependency site assembly are the baseline. Avoid caching pure file copies. If bundling becomes necessary, compile only changed games and include all relevant sources, shared code and lockfiles in cache invalidation.
- All mock state and development controls run entirely on the client; never use real cookies, coins or family data in GitHub Pages. Use `MockBackend` and `RealBackend` as documented in the README. The production API contract is only proposed and must be integrated separately in Family Wizard.
- A server, not the client, must authorize and atomically settle real coin transactions, and replay request IDs safely. No game may mint real task coins from a client result.
- Visible game text is German. Use relative URLs so the same game works under the stable root and `preview/`. Keep browser refresh without destroying mock progress.
- Run `npm run build` and relevant local tests when possible. Local tests are encouraged but not a deployment gate. Report explicitly if CI, merge or Pages availability could not be verified.
