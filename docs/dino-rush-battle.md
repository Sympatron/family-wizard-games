# Dino Rush — Game Design and Implementation Plan

Status: **playable prototype with merge-based progression and first balancing pass; live device playtesting remains outstanding**.

## 1. Goal and audience

Add a browser game to Family Wizard Games targeting ages **8–12**. The game combines a short, forward-running 3D shooting/collection phase with a 2D tactical dinosaur autobattler. The overall experience is a **roguelite**: build an army across consecutive stages, eventually lose, spend earned meta currency on permanent improvements, and begin a new run.

Name: **Dino Rush**. All visible UI text must be **German**, even if internal identifiers and documentation are English.

### Core loop

1. **Runner** (target length 35 seconds): travel forward automatically, steer horizontally, shoot enemies, choose and modify gates, and free dinosaurs.
2. **Formation & evolution**: place collected dinosaurs on a 3×5 player grid, evolve compatible dinosaurs, and prepare for battle.
3. **Autobattle**: an opposing team on its own 3×5 grid fights the player's army without manual combat commands.
4. **Rewards & recovery**: after victory, receive run money, heal or revive dinosaurs using purchasable potions, and enter the next stage.
5. **Defeat & metaprogression**: if the whole army is defeated, the run ends; discard all run-only dinosaurs, money and upgrades, award progress-based meta currency, and offer permanent upgrades before a new run.

The player should feel that runner performance affects army quality, while formation and evolution decisions can still overcome a stronger enemy team.

## 2. Decisions already made

| Area | Decision |
| --- | --- |
| Target players | Older children, approximately 8–12, with some strategy |
| Runner presentation | Genuine 3D |
| Track and movement | Straight forward path, automatic forward movement, **free horizontal steering** (not three fixed lanes) |
| Runner controls | Swipes/drag and left/right arrow keys |
| Shooting | Continuous automatic fire, **straight ahead**, no auto-targeting; positioning matters |
| Opponents | Enemies approach from the front |
| Gate selection | Typically two mutually exclusive gates; each changes stats such as damage, rate of fire, bullets/projectiles |
| Gate interaction | Gates are shootable; negative modifiers can be changed into positive ones by shooting |
| Runner length | Approximately **35 seconds** per stage |
| Dino acquisition | Shoot **cages/obstacles** to free collectible dinosaurs (not directly shoot dinos to collect them) |
| Battle presentation | 2D initially |
| Grids | Player and enemy each have a **3×5** formation grid |
| Evolution | **Two identical dinosaurs of the same species and tier** merge to Tier II or III; two Tier III units evolve to a new Rank +1 species at Tier I. |
| Combat | Melee units move toward opponents; ranged units fight at distance; support special abilities, area damage and status effects |
| Combat control | Press Start and watch an **automatic battle** until one side is eliminated |
| Injuries | Surviving dinosaurs **regenerate some HP after battle**; healing potions accelerate recovery; knocked-out dinos need revival/healing per the eventual potion rules |
| Run economy | Battle rewards fund in-run purchases, including potions |
| Failure | Entire army eliminated ⇒ game over, reset all run money, dinosaurs and temporary boosts |
| Meta economy | Earn separate meta currency based on run progress; spend on permanent improvements |
| Persistence | Permanent upgrades survive defeat; run state persists across stages and reloads while the run is active |

**Do not confuse game currencies with real Family Wizard task coins.** Both run money and meta currency are game-internal; real task-coin transfers are out of scope unless a separately authorized server integration is designed.

## 3. Items intentionally undecided

These are **not blockers for the first vertical slice** and should be data-driven, with temporary placeholder values:

- Whether all 15 cells may be occupied, exact inventory limits, and any reserve area.
- Further tuning of the defined 27-species roster, rarity weights, and battle stats.
- Detailed targeting priorities, ability activation (energy vs cooldown), enemy AI, status effects and special ability roster.
- Exact potion types, prices, revival behavior and rate of post-battle recovery.
- Economy scaling, meta currency formula, permanent upgrade trees, unlocks and difficulty curves.
- Gate shot thresholds and detailed positive/negative modifier formulas.
- Bosses, environmental hazards, stage variations and endgame length.
- Art direction, final dinosaur models, audio and effects.

Keep rules in simple data tables and simulation functions so they can be adjusted after playtesting.

## 4. Technical approach

The repository is a **static multi-game site** with native JS modules, automatic manifest discovery and GitHub Pages deployment. Its own `AGENTS.md` and `README.md` govern implementation.

### Chosen engines

- **Three.js** for the *real 3D* runner scene and camera.
- **Phaser** for the 2D formation screen and autobattle presentation (sprites, animation, input, drag/drop, tweens, effects, sound).
- **Plain modern JavaScript modules** for the rules, state transitions, simulation, progression and economy.
- **HTML/CSS** for screens, overlays, menus, rewards and upgrades.

This supersedes the earlier suggestion of rendering battles using raw Canvas 2D. No custom 2D renderer should be built from scratch.

Keep game logic **independent of both rendering engines**. The Three.js and Phaser layers should consume state and player input, not own the authoritative rules. Instantiate and pause/dispose renderers appropriately so that only the active phase is running.

For dependency delivery, prefer pinned and reproducible packages or a per-game build over unpinned CDN URLs. Any dependency/build changes should remain isolated to this game as far as possible; do not add an unnecessary repository-wide framework, test gate, server or Docker stack.

### Existing launcher integration

New game directory: `games/dino-rush-battle/`.

Must contain:
- `game.json` with matching ID, a German title/description and an icon.
- `index.html` using relative asset paths.
- JS/CSS/modules/assets as needed.

`scripts/build.mjs` automatically discovers valid game manifests and copies directories; the launcher consumes generated `games.json`. Keep the existing launcher and other games intact.

### Shared backend and persistence

Use `createGameBackend({gameId, initialGame, reducer})` from `shared/backend.js` in mock mode for development. Its `load()` and idempotent `execute({id,type,payload})` contract supports persisted snapshots, mock users, devtools and refresh restoration. Do **not** post an action for every animation frame. Persist at safe, meaningful boundaries (stage begin, collection result, formation changes, merge, battle resolved, purchases, defeat/meta rewards).

Keep at least two logical state partitions:

```js
{
  version: 1,
  meta: {currency: 0, upgrades: {}},
  run: {
    stage: 1, money: 0, army: [], inventory: [],
    potions: 0, temporaryUpgrades: {}, phase: 'runner'
  }
}
```

This is an illustrative shape, not a frozen schema. Use deterministic/serializable representation for dinosaur instances (unique ID, species, level, HP, formation cell, etc.), not engine objects.

`RealBackend` exposes a **proposed** REST contract, not a ready-to-use game server. An actual Family Wizard integration is a separate project and must validate/settle real coins server-side; a browser cannot mint real task coins.

## 5. Architecture and responsibilities

- **Game controller / state machine:** runner → preparation → battle → rewards → next runner; defeat → meta rewards → new run. Reject invalid transitions.
- **Runner simulation:** forward travel, lateral steering, fixed-rate projectile updates, collisions, enemy/cage/gate spawning, stat modifiers, collection.
- **Runner renderer (Three.js):** scene, track, camera, meshes, animations and visual feedback.
- **Dinosaur definitions:** data-driven species stats, abilities, roles, appearances and evolution edges.
- **Formation manager:** 3×5 coordinates, inventory, placement, merging, and chosen evolutions. Test formation constraints independently of UI.
- **Battle simulation:** fixed timestep, positions, targeting, movement, attack ranges, cooldowns, damage, deaths, abilities/statuses and deterministic victory result.
- **Battle presentation (Phaser):** sprite positions, hit effects, bars, drag/drop interactions, camera effects, HUD.
- **Economy and progression:** rewards, healing, potion spending, game over, meta currency, permanent upgrades.
- **Persistence adapter:** game-specific reducer behind the repository's existing shared backend.

A Phaser scene should visualize battle-simulation events and may interpolate positions, but it must not be the sole source of HP, damage, rewards or combat outcomes.

## 6. Implementation phases and acceptance criteria

### Phase 1 — Foundation
- Create game manifest, page, styles and game modules.
- Wire mock backend, devtools and deployment watcher.
- Add an explicit phase controller, initial state, transitions and restoration after refresh.
- German UI, responsive to desktop and mobile.
- **Done when:** the new game appears in the launcher, runs from relative URLs and can move between placeholder phases.

### Phase 2 — Playable 3D runner
- Straight 3D path with third-person camera and player placeholder mesh.
- Automatic progress and straight-ahead shooting; swipe/drag and arrow-key horizontal control.
- Fixed duration or track distance; obstacles/enemies from ahead; damage/destruction.
- Paired gates with selectable modifiers. Shooting a negative gate can improve or flip its value.
- Breakable cages yielding dinosaurs and clear collection feedback.
- **Done when:** playing the runner for roughly 1–2 minutes produces upgrades and collectible dinos for the next phase.

### Phase 3 — Formation and evolution
- Display player 3×5 formation, collected units and enemy formation.
- Place/swap units via desktop and touch controls.
- Merge same-species, same-level pairs into a stronger different species, choosing one of two branches; prototype species can be minimal.
- **Done when:** collected dinos can be organized and merged into a legal army.

### Phase 4 — Autobattler
- Headless, fixed-step combat simulation.
- Melee movement; ranged attacks; basic targeting; HP and deaths.
- Configurable ability/event interface, then at least one example of AOE/status effects.
- Phaser visualizes the two teams and battle events; Start runs until victory or defeat.
- **Done when:** the battle ends deterministically with a reported winning side and updated survivor HP.

### Phase 5 — Roguelite economy and persistence
- Stage rewards, run currency, between-stage healing and potion purchase/use.
- Partial survivor recovery, injuries/knockout handling, progression to harder stages.
- On total defeat: progress-based meta rewards, run reset, permanent upgrade purchase and new run.
- State survives refresh; ensure idempotent transaction-like updates in mock reducer.
- **Done when:** a complete run, loss, meta upgrade and new run are playable.

### Phase 6 — Content and polish
- More dino species and branching evolutions, enemies, gates and upgrades.
- Better low-poly models, animation, particles, sound and kid-friendly feedback.
- Tutorials, difficulty tuning, performance and mobile/desktop QA.
- **Done when:** the game is enjoyable and stable on target browsers/devices.

### Milestone sequence

1. **Playable runner.**
2. **Playable formation + autobattle.**
3. **First complete stage:** runner → formation → battle → rewards.
4. **Complete roguelite loop:** healing, defeat, meta upgrades, restart.
5. **Polish and release.**

A prototype should use simple meshes/sprites and deliberately few species. Prefer a complete vertical slice over many unfinished systems.

## 7. Test and release strategy

- Add **focused** Node tests for phase transitions, merging/branch choice, formation legality, combat outcomes, HP recovery, run loss, currency conservation and persistence.
- Browser-check keyboard, touch/drag steering, resizing, pause/restart, WebGL support, frame rate, visibility/background behavior and reload checkpoints.
- Execute `npm run build` plus relevant local tests. Current PR CI runs the Node test suite and the static build; keep new tests scoped to this game.
- Work via focused branches and PRs. Merge only after required checks have passed and mergeability is verified.
- Stable URL: `https://sympatron.github.io/family-wizard-games/`; dev preview under `preview/`. Both snapshots must use relative paths.
- Check Pages after merge; opening a PR alone does not deploy the game.

## 8. Non-goals for initial implementation

- Production Family Wizard API endpoints or real-coin integration.
- Multiplayer, cloud sync or accounts beyond the existing mock adapter.
- Final art packs, full evolution taxonomy, complicated bosses or a definitive game balance.
- Moving the 2D battle into 3D.
- A new project-wide application framework.

## 9. Open design principle

Build *behavior first, balance second*: use editable definitions for unit types, modifiers, evolution branches, stages, healing and meta upgrades, so detailed decisions can be made from a real playable prototype rather than further questionnaires.


## 10. Expanded evolution and first balancing pass

The roster contains **27 species** across ranks I–IV (3 / 6 / 12 / 6) and **three mastery tiers per species**. Upgrading tiers only requires merging **two dinosaurs of the same species and tier**, never money. Merging two Tier III units advances to a Rank +1 species at Tier I. At Rank IV, dinosaurs can still gain mastery tiers but cannot evolve to Rank V.

Families:
- Raptor → Allosaurus / Troodon → Carnotaurus / Giganotosaurus or Dilophosaurus / Deinonychus → Tyrannosaurus or Utahraptor
- Triceratops → Ankylosaurus / Stegosaurus → Euoplocephalus / Saichania or Kentrosaurus / Miragaia → Borealopelta or Dacentrurus
- Pteranodon → Quetzalcoatlus / Tapejara → Hatzegopteryx / Arambourgiania or Tupandactylus / Caiuajara → Thanatosdrakon or Thalassodromeus

Each pair of Rank III branches converges to an apex species, which inherits the previous species' passive trait. Without higher-tier rescues, a Rank IV Tier I requires **512 Rank I Tier I starters**, and Rank IV Tier III requires 2,048. Wild higher-tier rescues make this a difficult long-term progression goal rather than a fixed number of runs.

### Runner tuning

| Setting | Implemented value |
| --- | --- |
| Runner | 35 seconds; finish line arrives as the timer reaches zero |
| Cage density | About 9 reachable early cages instead of dozens |
| Common cage | Rank I Tier I; stage-dependent HP |
| Reinforced cage | Stage 3+; Rank I Tier II; 2.2× common HP |
| Rare cage | Stage 8+; Rank II, or Rank III from stage 25 |
| Rare mastery | Tier II from stage 10, Tier III from stage 45 |
| Preferred species | Up to 55% of eligible rare spawns favor species already owned |
| Cage HP | 5 + ceil(min(stage, 30) × 0.52); rare HP capped at 65 |
| Runner damage | Max 3 total damage per volley |
| Firing speed | Max 2.5×; at most 5 projectiles |
| Multi-shot | Total damage split equally, with each projectile spread slightly outward |
| Coin collection | Larger 1.8-world-unit pickup radius; 1/5/10 coin values |

No hard dinosaur rescue cap; the smaller number of breakable cages and target selection provide the intended collection limit.

### Combat and persistence

Opposing front lines begin 460 virtual units apart and move more quickly during the initial approach. Enemy size, mastery tier and ranks increase across stages. Mastery scales power by 1.8 per tier, with an additional rank multiplier; abilities include poison, bleeding, armor, reflection, counterattacks, evasion, piercing, cleave, healing, support, fast attacks, burst, and stun. All 27 species have SVG battle illustrations and distinct low-poly runner variants.

Saved state version 2 migrates existing version 1 dinosaur mastery levels without changing the game ID, unit IDs, or formation positions. All in-game currencies remain unrelated to real Family Wizard task coins.

**Testing:** Rules, drops, rarity, projectile damage, and progression have automated tests. Full visual and real-device gameplay verification remains outstanding.
