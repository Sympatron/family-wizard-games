# Family Wizard Games

Independent browser games for [Family Wizard](https://github.com/Sympatron/family-wizard). This repository is a **multi-game monorepo**: one shared client-side backend contract, one game launcher, and one static GitHub Pages deployment containing every game. The repository does not contain the Family Wizard server or its database.

## Run locally

Requires Node.js 22 or newer. No npm dependencies or install step are required.

```sh
npm run dev
```

Open http://localhost:4173/. The development server rebuilds on file changes. Open tabs poll `version.json` and reload automatically, retaining mock data in browser storage.

```sh
npm run build
npm test
```

The first command assembles `dist/`; the second runs optional local Node tests. CI intentionally runs **build only**, not the test suite.

## Site structure and deployment

- `main` publishes the stable launcher and games to `https://sympatron.github.io/family-wizard-games/`.
- `dev` publishes the development snapshot under `https://sympatron.github.io/family-wizard-games/preview/`. The `/preview/` landing page lists **all open PRs**, with playable links for each same-repository PR and a link to GitHub for fork PRs; it also links to games from `dev`.
- A push to either branch rebuilds and deploys **both** snapshots in one GitHub Pages site. Before `dev` exists, preview temporarily mirrors `main`.
- Every open same-repository pull request gets an isolated preview at `https://sympatron.github.io/family-wizard-games/preview/pr-<number>/`. It refreshes after each PR commit (via the build-check workflow) **without merging**. Closing the PR removes its preview on the next deployment. PRs from forks receive build checks but are not hosted.
- Each GitHub Pages deployment rebuilds stable, dev and all open same-repository PR snapshots together. GitHub Pages hosts one artifact, so publishing just one PR in isolation would otherwise erase the others. The Pages workflow cancels superseded deployments to prevent a long backlog during rapid commits. PR checks must pass before they trigger publishing.
- Pull requests run only the lightweight static build check; no tests, linting, Docker or Python are run by CI.
- Each deployment contains a `version.json` with the source branch commit SHA. Open pages check for changes every eight seconds and reload without discarding mock local storage.

Enable **Settings → Pages → Build and deployment → GitHub Actions** in GitHub once. The website can remain public even when the repository is private. GitHub Pages publishing from private repositories requires an eligible GitHub plan; GitHub Free requires a public repository. Never commit secrets, production data, or private family content.

### Why there is no build cache

The initial games use native browser JavaScript modules: the site build just copies individual game directories, shared modules and manifests. There is **no compilation**, package installation or bundler to cache. Uploading and restoring an Actions build cache would likely take longer than copying these small files. Adding a game does not require editing the root build configuration. If a future game needs TypeScript/Phaser/bundling, add a *per-game* build task with output caching keyed to the game's source, shared inputs and dependency lockfile; untouched games should not be recompiled.

## Adding a game

Create `games/<id>/game.json`, `games/<id>/index.html` and JavaScript or asset files. The directory ID must be lowercase ASCII letters, digits or internal hyphens. Example manifest:

```json
{"id":"my-game","title":"Mein Spiel","description":"Kurze Beschreibung","icon":"★"}
```

The build discovers all game manifests, checks the ID and entry page, and generates `games.json` for the launcher. Use relative URLs for assets and links so stable and preview paths both work. `games/example/` is a working integration example; it is not a production Family Wizard game.

## Shared game backend contract

A game obtains an adapter through `createGameBackend({gameId, initialGame, reducer, mode, csrfToken, apiRoot})` in `shared/backend.js`.

Both adapters expose these asynchronous methods:

- `load(): Promise<Snapshot>`
- `execute({id, type, payload?}): Promise<Snapshot>`

Snapshot shape:

```json
{
  "user": {"id":"alex","name":"Alex","role":"user"},
  "coins": 250,
  "game": {"stars":0,"power":1},
  "revision": 0,
  "message": ""
}
```

The `id` is a unique request ID. Repeating an operation must return the original result and must never settle an expense twice.

### Client-side mock adapter

`MockBackend` implements the contract entirely in JavaScript; no HTTP server or online credentials are needed. It receives a game-specific `reducer(gameState, action, {user, coins})` that returns `{game, coins?, message?}`. It persists simulated users, a **shared wallet per simulated user across games**, per-game state and the last 100 operation results in `localStorage`. The mock is not trusted and deliberately permits arbitrary edits.

`mountDevtools(backend)` adds an on-page panel in mock mode for switching users, changing the coin balance, setting network delay, failing the next action, editing any game state as JSON and importing/exporting scenarios. Use the panel to reach hard-to-test states without replaying the game. Mock data remains on the current browser/device and never reaches Family Wizard. A reset affects the selected user's current game and mock wallet. The browser's origin separates stable from preview storage automatically because they share an origin **only if distinct storage key prefixes are used**; see the note below.

**Stable/preview storage isolation:** All sites share a GitHub Pages origin, so the mock backend includes `stable`, `preview` or a unique `preview-pr-<number>` in its storage key prefix. They retain independent game states, wallets and user selections in the same browser profile.

### Real Wizard adapter (contract; backend endpoints not yet implemented)

`RealBackend` uses same-origin, cookie-authenticated requests:

- `GET /api/games/{gameId}/state` → `Snapshot`
- `POST /api/games/{gameId}/actions` → `Snapshot`, JSON body `{id, type, payload?}` and `X-CSRF-Token` header

These are **proposed endpoints**, not currently implemented in `family-wizard`. When integrating a game, implement the corresponding authorized routes or supply a game-specific adapter mapping to existing routes. The server must independently validate the device/user, enabled game, request ownership, CSRF/origin, idempotency and game rules. Wallet spending and effect grants must commit in one database transaction; no arbitrary browser value may credit real coins. Do not load the mock state or devtools into a real production Wizard game.

The game renders its authoritative snapshot but owns the local animations, controls and presentation. The mock reducer mirrors intended game logic for development; server authority remains essential for the real integration.
