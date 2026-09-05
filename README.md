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
- **A level you cleared stays cleared for the whole run.** Walk back through it
  and its pack is still down; a fight you broke off mid-way is still half-fought
  when you return. The run remembers the corridor in `chamberHealth`, which is
  persisted with the rest of the save so a reload does not restock it.
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

Which level you are in is a **fact about where you are**, not something a
trigger decided on the way past: `stageTravelTarget()` compares the dino
against the two planes that bound its chamber and `ArenaTravel` hands the
answer to the store each frame. That one rule is what makes the corridor
walkable in reverse - the gates used to own a direction each and fire on
proximity, so stepping back through an open exit ran the *forward* one again
and pushed you into the level you were trying to leave. The gates are now a
door and a sign; they travel nobody.

Only three chambers are mounted at a time - behind, current, ahead - so the cost
stays flat however deep a run goes.

The wall standing in front of chamber `k` is chamber `k-1`'s **back wall** - the
same wall, seen from the other side, and the doorway you look back through into
the level you came from.

**Three chambers stay mounted either side of the one you are in**
(`CHAMBERS_BEHIND` / `CHAMBERS_AHEAD`), so from Stage 3 you can see 4, 5 and 6
through the open gate and 2, 1 and the hub back through the entrance. Only one
was ever mounted ahead, so the corridor genuinely stopped a doorway in front of
you and the next level was built from scratch as you crossed into it.

Seeing them takes four things agreeing, and they are all derived from
`CORRIDOR_SIGHT` and `HORIZON_DISTANCE` in `data/weather.js` so they cannot
drift apart: the chamber has to be **mounted**, inside the **fog** (`fogFar`
now reaches past three chambers), in front of the **skyline** (which moved from
88 out to 240 and scaled up by the same factor, so it subtends exactly the
angle it always did rather than standing in the middle of the corridor), and
inside the camera's **far plane** (140 clipped the far end of the corridor
clean away; it is 460 now).

Chamber zero has no chamber before it, so it gets a wall of its own from
`buildArenaMouth()` - the arena's mouth, built as the back wall's mirror - and
`buildHubApproach()` builds what you see through it: the flight of steps you
climbed to get in, and the hub at the bottom of them. That is scenery, not
level; you leave through the doorway a few paces short of the top step. It is
built from the **hub's own measurements** (`ARENA_ENTRANCE`, `PLAZA`, `PODIUMS`,
`TRAINING_POSITIONS`, shifted by `LOBBY_Z_OFFSET` and dropped by
`APPROACH_DROP`), so the staircase you look down is the staircase you climb and
the podiums are where you left them. Chamber zero's floor slab runs out to
`APPROACH_EDGE_Z` to meet it, and the bedrock plane stops there too - at the
arena's own floor level it would bury the whole view.

**Every level has its own palette.** `paletteForStage()` takes the biome's
colours and shifts them a little further with each level inside it,
deterministically. Stage 6 is recognisably the same jungle as Stage 5 but
visibly not the same room, and because the chamber ahead is already mounted you
see its colours through the open gate before you walk into them.

The exit gate is **sealed until the chamber is clear** - the barrier is
literally the edge of the world until the last enemy falls. The sign over it
states what the level ahead demands *before* you step through, and turns red
when your damage is under that bar.

**Any gate can be walked through.** Stepping into a level you were underpowered
for used to kill the dino on the spot, before it had swung once - which made
the requirement a wall with a trap behind it rather than something to test
yourself against. The pack is the wall now: `enemyBite` already scales with how
the level rates against your click power, so a chamber you have no business in
chews through you in seconds. Lose that fight and you wake in the hub, the same
as any other death.

And until you do, **breaking off is always available.** Walk back out through
the gate you came in by: the level behind is still cleared, everything you are
carrying is still carried, and the pack you fled cannot follow - enemies are
clamped to their own chamber, leaving a whole wall between them and you.

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
- **The seam works from both sides.** The arena shows the hub down through its
  mouth (`buildHubApproach`) and the hub shows Stage 1 up its staircase — the
  *real* chamber, the same `Chamber` component the arena mounts, shifted into
  hub space by `APPROACH_DROP` / `LOBBY_Z_OFFSET`. The two mappings are exact
  inverses, the stairs land on the chamber floor with no step, and the mouth
  wall ends exactly on the seam, so what you look at from either end is what
  you arrive in.
- **One headline over the gate, everything else quiet.** `GateHeadline` hangs
  the destination above the gateway - "Defeat all enemies first!" with the
  head-count while the pack is up, then the stage ahead and its recommended
  damage. Its height and forward offset are tuned against the camera rig, not
  guessed: the title lands 15-24% down the screen from anywhere in the chamber
  and reads ~60px tall from the far end. It is the one piece of world text that
  never fades, because it is the destination.
- **Every chamber in sight has gates, not just the one you are in.** `Gates`
  walks the same `chamberWindow` the environment builds, so the levels ahead
  are levels rather than rooms with no way out and the ones behind still read
  as places you fought. **Each gate seals on its own chamber**, read straight
  out of the run's `chamberHealth`, so the levels ahead stand shut and the ones
  behind stand open - the corridor being several barriers deep is the run laid
  out in front of you. `active` marks only which gate talks to the HUD. The
  gateway sits in the *middle* of the wall it is cut through and the barrier
  hangs between its towers; against the near face they read as two towers and
  an unrelated pane of light.
- **The barrier is the gate's own sign.** It never slides away - it used to
  drop into the floor on a clear, taking the only thing that said where the
  doorway went with it. It stays lit across the gateway and changes state
  instead: **red while the level holds it shut, blue once it will let you
  through**, with the stage ahead and its recommended damage lettered onto both
  faces. Open, it thins from 0.6 to 0.2 opacity, because a doorway exists to be
  looked through and 80% of the next level still has to get past it.
  `GateHeadline` above it keeps only what the fight needs - "Defeat all enemies
  first!" and the head-count - so the two never say the same thing twice.
- **Idle damage only lands in reach.** Left ticking from anywhere it cleared
  every chamber a run had out-levelled before the player finished walking in -
  at 71K damage, a quarter of it per second, Stages 1 to 4 fell in under a
  second each. It now obeys the same reach a swing does.
- **Each shape fights its own way** (`ATTACK_STYLES`). A sailback breathes fire
  from further than you can hit back; a runner's teeth cannot reach you without
  closing; a shielded one hits half as often for half again as hard. Reach,
  cooldown and power *multiply* the shared numbers in `data/combat.js` so one
  set of tuning knobs still governs the whole fight, and `EnemyAttackEffects`
  draws the difference from a fixed instanced pool.
- **Both ends of a chamber stay empty.** The exit is two standing pillars and
  an opening; the entrance is two posts and a glow on the floor. Nothing spans
  either gap - no arch, no lintel, no plank, no strip painted down the
  gateway - because the whole value of the opening is that you can see the next
  level through it, and every marker tried there stood in front of the thing it
  was naming. Every solid piece of both gates is checked against
  `PASSAGE_HALF_WIDTH` so it cannot creep back into the walkway.
- **The camera reads the corridor as a continuous profile**
  (`corridorHalfWidthAt`). Read as a step - wide, then abruptly the width of a
  doorway - it threw the camera eight metres sideways the instant a boundary
  was crossed, which is precisely where a boundary is crossed. The taper runs
  *up to* a wall's face and is fully closed before the band begins, never the
  other way round, or the camera ends up inside geometry it is meant to be kept
  out of. A sealed gate still holds it back, but only while sealed - the old
  test asked whether the *player* was inside the hollow and switched off the
  moment they stepped into the passage, teleporting the camera ten metres. And
  where the walls squeeze it in, `LobbyCamera` gives up height rather than
  distance, so the shot never goes vertical.
- **Signs in the world fade with distance** (`systems/signage.js`). A chamber
  has four things with writing on them — the way on, the way back and two
  cash-out pads — and every one used to shout at full volume from anywhere in
  it, so standing at a gate meant the board in front of you, the sign at the
  far end and both pads stacked up the middle of the screen with the fight
  somewhere behind. A sign is drawn when you are close enough to act on it;
  only the *nearer* Return pad is ever labelled, since both offer the same
  deal. The exit arch itself never fades — it is what frames the next biome —
  only the writing on it. troika reads `fillOpacity` in its own
  `onBeforeRender`, so these are written per frame with no re-render and no
  `sync()`.
- **The entry gate carries no writing at all.** The camera orbits ~9 up and ~19
  back, so anything there sits between the lens and the level behind you. An
  arch blocked the chamber, a full-width plank landed mid-frame, and a
  waist-high signpost still stood squarely in front of the level it named. The
  way back needs no label - the level you came from is visible down the
  corridor, which is the whole point.
- **Audio is synthesised** at runtime via Web Audio — no audio files ship.
  Footfalls are driven from the same `stride` phase that swings the legs
  (`systems/footsteps.js`), so a step is heard on the frame the foot is down;
  the whole pack shares one rate limit and fades with distance, because seven
  dinos running at you is otherwise white noise rather than footsteps.
- **Each training pad is dressed differently** (`buildPadDecor`). Nine pads
  that differed only in colour read as one pad printed nine times; the row is
  meant to be a ladder you can see yourself climbing. The layouts are written
  without regard for spacing and squeezed to fit afterwards by `fitToRow`,
  because a pad has the whole lawn across the row and under three metres of it
  along the row.
- **Saves are debounced** to localStorage through `systems/persistence.js`, the
  single place storage is touched, and flushed on tab hide.
- **`npm run smoke` is what says the app works**, not `npm run build`. Vite only
  bundles - it resolves no names across modules, so a component referencing an
  import that was dropped builds perfectly and then throws the instant React
  renders it, leaving a blank page and a green build log. The smoke check boots
  the dev server, loads the app in headless Chrome, and fails on an empty root
  or on anything reaching `console.error`.

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
