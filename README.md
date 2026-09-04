# +1 Dino Evolution (clone)

A browser idle/clicker battler built with React Three Fiber. Original assets and
art only — this reproduces the *mechanic*, not any Roblox-owned art, audio,
trademarks or UI chrome.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build
npm run server       # optional leaderboard server, ws://localhost:8787
```

## The loop

Walk the **hub** to equip a dino from the podium gallery, stand on a **training
pad** to earn permanent damage, then climb the **arena staircase** to fight.

The **arena** is walkable too: you control your dino directly, close the
distance on a pack of enemy dinos and fight them down. Clear stages for Wins,
spend Wins on upgrades, unlock evolution tiers, and eventually **rebirth** for
a permanent multiplier.

### Controls

| | |
| --- | --- |
| Walk | `WASD` / arrows, or the on-screen stick |
| Jump | `Space`, or the Jump button |
| Attack | Left click, or the Attack button |
| Look | Right-drag (one-finger drag on touch), wheel to zoom |
| Interact (hub) | `E`, or the Interact button |

Attacks only land inside `ATTACK_RANGE`, which is what makes the arena a place
you move through rather than a button you hold from the doorway. **Auto Fight**
swings for you but still respects range, so positioning keeps mattering.

### A run, not a save point

Every trip into the arena **starts at Stage 1**. How far you got last time is
not a checkpoint - what you keep is the Wins you carry out.

- Clearing a level adds its reward to the Wins you are **carrying**, shown as
  the `Carried` chip. Carried Wins are not spendable yet.
- Two **Return pads** appear at the end of a cleared level. Stepping on one
  banks everything you are carrying and walks you back to the hub.
- Walking back out through the **near end** of a chamber retreats one level at a
  time; doing it in Stage 1 leaves the arena and banks the run. There is no menu
  shortcut home - the way out is the way you came.
- **Dying loses everything you were carrying.** That is what makes the Return
  pads a real decision: cash out now, or push one more gate.

The **Levels** panel is therefore a read-only progress board and damage
reference, not fast travel - jumping straight to Stage 40 would undercut the
entire walk.

### The corridor

Levels are chambers laid **end to end along -Z**, chamber `k` at world
`-k * CHAMBER_SPAN`. Nothing is ever teleported: you walk out of one level,
through the gap in its back wall, and into the next. Crossing a boundary only
changes which chamber the bounds are anchored to, and those bounds overlap by a
passage length so the clamp never yanks you back into the level you just left.

Only three chambers are mounted at a time - behind, current, ahead - so the cost
stays flat however deep a run goes.

**Every level has its own palette.** `paletteForStage()` takes the biome's
colours and shifts them a little further with each level inside it,
deterministically. Stage 6 is recognisably the same jungle as Stage 5 but
visibly not the same room, and because the chamber ahead is already mounted you
see its colours through the open gate before you walk into them.

The exit gate is **sealed until the chamber is clear** - the barrier is
literally the edge of the world until the last enemy falls. The sign over it
states what the level ahead demands *before* you step through, and turns red
when your damage is under that bar.

**Walking through underpowered kills your dino** - and costs you the run. The
sign warns you in red first; stepping through anyway is your call.

### Enemy packs

Pack size cycles 3-7 per level so the rhythm of a run varies, and a boss stage
fields one large dino alone. Rather than give each enemy its own health value,
the pack divides the stage's single health pool into bands - so rewards, gating,
saves and the damage pipeline all stay untouched, and the pack visibly thins as
the pool drains. The enemy being fought closes in on you; the rest hold their
formation posts.

## Levels and damage gating

Stages open in order, and each one also states the click damage it is tuned for.

- `recommendedDamage(stage)` = the stage's health / `TARGET_CLICKS_TO_CLEAR`, so
  the advice can never drift from the actual health curve.
- `requiredDamage(stage)` is `MIN_DAMAGE_FRACTION` of that. Walk through a gate
  below it and your dino dies, so the floor is what sends a player back to
  training rather than letting them chip at a wall for an hour.
- `damageRating()` turns the ratio into Easy / Fair / Grindy / Too strong, which
  colours both the stage panel and the **Levels** board.

## Where to tune

All balance lives in `src/data/` — no numbers are hardcoded in components.

| File | Owns |
| --- | --- |
| `stages.js` | `BASE_HEALTH`, `GROWTH_RATE`, boss cadence, rewards, damage gating |
| `evolutions.js` | The 13 tiers: `unlockAtWins`, `power`, shape flags, colours |
| `progression.js` | `REBIRTH_WINS_REQUIRED`, rebirth multiplier, number formatting |
| `upgrades.js` | Shop costs and per-level effects |
| `training.js` | Training pad rates and rebirth gates |
| `areas.js` | The 5 biomes plus `paletteForStage()` per-level variation |
| `arena.js` | Chamber geometry, `CHAMBER_SPAN`, bounds, formations, attack range |
| `enemies.js` | Enemy body archetypes and per-biome colouring |
| `lobby.js` | Hub layout, podium rows, collision, scenery |

## Architecture notes

- **The Zustand store is the single source of truth.** Components are
  presentation-only and call store actions.
- **Effects go through an event bus** (`systems/events.js`), not React state.
  Particles, camera shake, floating text and SFX all subscribe there, so a fast
  clicker never re-renders the tree to show a hit.
- **Hot values are read imperatively.** Enemy health changes on every tap, so
  the health bar and 3D bar read the store from a frame loop and write straight
  to the DOM / object transforms.
- **Hit-stop** is a global time scale (`systems/timeScale.js`); every animated
  system multiplies its own delta by it, so the scene freezes together.
- **Rapier is scoped to stage-clear debris only.** Per-hit sparks go through a
  fixed-capacity instanced particle pool, which never allocates.
- **One movement controller** (`systems/playerMovement.js`) serves both the hub
  and the arena, so the dino handles identically in each. Neither scene puts the
  player in a physics world: clamping to bounds and pushing out of a few prop
  circles is cheaper and far more predictable.
- **Areas lerp by reference.** Materials hold the live palette `THREE.Color`
  instances, so one lerp per frame recolours the whole arena with no re-render.
  (Note: pass colours by assigning `material.color = c`; the constructor copies.)
- **Audio is synthesised** at runtime via Web Audio — no audio files ship.
- **Saves are debounced** to localStorage through `systems/persistence.js`, the
  single place storage is touched, and flushed on tab hide.

## Swapping in real GLB models

Tiers ship with `model: null` and render blocky placeholder geometry driven by
the shape flags. Drop a GLB into `public/` and set the path:

```js
{ id: 'rex', name: 'Tyrant Rex', model: '/models/rex.glb', ... }
```

`DinoModel.jsx` loads it with `useGLTF` behind a Suspense boundary and an error
boundary that falls back to the placeholder, so a missing or broken file never
blanks the canvas.

Asset pipeline: Tripo AI → Blender cleanup (Ctrl+J join, Ctrl+A apply
transforms, Merge by Distance) → Mixamo rigging → `fbx2gltf` → GLB.

## Leaderboard (optional)

Read-only and off by default. With no URL configured the panel is hidden
entirely and the game runs fully offline.

```bash
npm run server
VITE_LEADERBOARD_URL=ws://localhost:8787 npm run dev
```

Scores are self-reported, so this is a friendly scoreboard rather than an
authoritative ranking; anything stricter needs server-side simulation.
