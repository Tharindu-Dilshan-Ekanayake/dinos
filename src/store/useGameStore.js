import { create } from 'zustand'
import {
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  MAX_STAGES,
  canEnterStage,
  isBoss,
  recommendedDamage,
  stageHealth,
  stageReward,
} from '../data/stages.js'
import { EVOLUTIONS, evolutionIndexForWins } from '../data/evolutions.js'
import {
  BASE_STRENGTH,
  REBIRTH_WINS_REQUIRED,
  computeClickPower,
  damageForClear,
  rebirthMultiplier,
} from '../data/progression.js'
import { CLEAR_HEAL, MAX_PLAYER_HEALTH } from '../data/combat.js'
import {
  UPGRADES,
  critBonus,
  idleDpsFraction,
  strengthFromLevels,
  upgradeCost,
} from '../data/upgrades.js'
import { areaIndexForStage } from '../data/areas.js'
import { MIN_HITS_TO_CLEAR, enemyCountForStage } from '../data/arena.js'
import { EVENTS, emit } from '../systems/events.js'
import { loadSave } from '../systems/persistence.js'
import {
  HUB_ARRIVAL,
  HUB_RETURN,
} from '../data/lobby.js'
import { placePlayer, playerFacing, playerPosition } from '../systems/playerState.js'
import { SEAM_MARGIN, arenaToHubPoint, hubToArena } from '../data/arena.js'

const COMBO_WINDOW_MS = 900
const MAX_COMBO = 8
/**
 * How long the last enemy's own death animation takes (see EnemyDino.jsx's
 * `a.death -= delta / 0.55`), plus a small margin for a slow frame. The gate
 * does not actually unseal until this long after the killing blow, so it can
 * never read as open while the pack is still visibly falling - see
 * `_applyDamage` / `_clearStage`.
 */
const CLEAR_DELAY_MS = 620

function freshRun() {
  return {
    strength: BASE_STRENGTH,
    wins: 0,
    totalWins: 0,
    stageIndex: 0,
    enemyHealth: stageHealth(0),
    upgradeLevels: { strength: 0, idle: 0, crit: 0 },
    /** True once this level's pack is down and the exit has unsealed. */
    stageCleared: false,
    /** True from the killing blow until the pack finishes its own death animation. */
    clearPending: false,
    /** Wins carried this arena run, banked only on the way out. */
    runWins: 0,
    /** Damage earned by standing on training pads. Reset by a rebirth. */
    trainedPower: 0,
    /** Damage earned by fighting - every blow landed and every level cleared. */
    battlePower: 0,
    /**
     * What this run has already done to each chamber: remaining pack health
     * keyed by level, and zero once that level is clear.
     *
     * A level used to be rebuilt from its curve every time you set foot in
     * one, so walking back through ground you had already taken put the whole
     * pack back on its feet and they came at you again. A run remembers
     * instead - cleared stays cleared, and a fight you broke off is still
     * half-fought when you come back to it.
     */
    chamberHealth: {},
    unlockedIndex: 0,
    equippedIndex: 0,
    evolutionIndex: 0,
  }
}

/**
 * Effective tier: whatever the player has equipped from a lobby podium, but
 * never above what they have actually unlocked.
 */
function effectiveEvolution(unlockedIndex, equippedIndex) {
  return Math.max(0, Math.min(unlockedIndex, equippedIndex))
}

/** Remaining pack health for a level this run - full if never touched. */
function chamberRemaining(chamberHealth, stageIndex) {
  const max = stageHealth(stageIndex)
  const saved = chamberHealth?.[stageIndex]
  if (saved === undefined) return max
  return Math.max(0, Math.min(max, saved))
}

/** Snapshot the level being left, so coming back to it finds it as it was. */
function rememberChamber(state) {
  return {
    ...state.chamberHealth,
    [state.stageIndex]: state.stageCleared ? 0 : Math.max(0, state.enemyHealth),
  }
}

/** Rebuild derived fields from the raw persisted numbers. */
function derive(state) {
  const evolutionIndex = effectiveEvolution(state.unlockedIndex, state.equippedIndex)
  const evolution = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const strength =
    BASE_STRENGTH +
    strengthFromLevels(state.upgradeLevels.strength) +
    (state.trainedPower ?? 0) +
    (state.battlePower ?? 0)
  const clickPower = computeClickPower(strength, state.rebirths)
  return {
    evolutionIndex,
    strength,
    clickPower,
    /*
     * What one swing is *worth* - the number the podium advertises, and what a
     * training pad multiplies. Distinct from `clickPower`, which is what a
     * swing takes off an enemy.
     */
    perClick: evolution.power ?? 1,
    idleDps: clickPower * idleDpsFraction(state.upgradeLevels.idle),
    critChance: Math.min(0.85, CRIT_CHANCE + critBonus(state.upgradeLevels.crit)),
  }
}

const initial = (() => {
  const base = {
    ...freshRun(),
    rebirths: 0,
    lifetimeWins: 0,
    bestStage: 0,
    muted: false,
    autoFight: false,
    /**
     * Graphics preset: 'auto', or one of the ids in systems/quality.js.
     *
     * 'auto' is a guess made from the machine's core and memory counts, which
     * is the most the browser will say - a player whose machine guesses wrong
     * is one menu away from overriding it, and the override is what gets saved.
     */
    quality: 'auto',
    playerName: '',
    scene: 'lobby',
    // Death is transient: you always come back at the hub.
    dead: false,
    /** Your own health in the arena. Transient - a run always starts whole. */
    playerHealth: MAX_PLAYER_HEALTH,
    // Transient, never persisted.
    comboCount: 0,
    lastClickAt: 0,
    areaIndex: 0,
    hydrated: false,
  }

  const save = loadSave()
  if (save) {
    base.rebirths = Number(save.rebirths) || 0
    base.muted = Boolean(save.muted)
    base.autoFight = Boolean(save.autoFight)
    if (typeof save.quality === 'string') base.quality = save.quality
    if (!save.migrated) {
      base.wins = Number(save.wins) || 0
      base.totalWins = Number(save.totalWins) || 0
      base.lifetimeWins = Number(save.lifetimeWins) || 0
      base.bestStage = Number(save.bestStage) || 0
      base.playerName = typeof save.playerName === 'string' ? save.playerName : ''
      base.stageIndex = Math.min(MAX_STAGES - 1, Math.max(0, Number(save.stageIndex) || 0))
      base.upgradeLevels = {
        strength: Number(save.upgradeLevels?.strength) || 0,
        idle: Number(save.upgradeLevels?.idle) || 0,
        crit: Number(save.upgradeLevels?.crit) || 0,
      }
      base.trainedPower = Math.max(0, Number(save.trainedPower) || 0)
      base.battlePower = Math.max(0, Number(save.battlePower) || 0)
      base.unlockedIndex = evolutionIndexForWins(base.totalWins)
      base.equippedIndex = Number.isInteger(save.equippedIndex)
        ? Math.min(base.unlockedIndex, Math.max(0, save.equippedIndex))
        : base.unlockedIndex
      base.scene = save.scene === 'arena' ? 'arena' : 'lobby'
      base.areaIndex = areaIndexForStage(base.stageIndex)
      base.stageCleared = Boolean(save.stageCleared)
      const max = stageHealth(base.stageIndex)
      const saved = Number(save.enemyHealth)
      base.enemyHealth = base.stageCleared
        ? 0
        : saved > 0 && saved <= max
          ? saved
          : max
      /*
       * A reloaded run resumes mid-corridor, so it needs the whole map back or
       * every level it had already walked back through would be restocked. The
       * level being resumed on is written last, since its health is the one
       * number the save has always carried and is the more trustworthy of the
       * two if they ever disagree.
       */
      base.chamberHealth = {}
      if (save.chamberHealth && typeof save.chamberHealth === 'object') {
        for (const [key, value] of Object.entries(save.chamberHealth)) {
          const index = Number(key)
          const health = Number(value)
          if (Number.isInteger(index) && index >= 0 && index < MAX_STAGES && health >= 0) {
            base.chamberHealth[index] = Math.min(health, stageHealth(index))
          }
        }
      }
      base.chamberHealth[base.stageIndex] = base.enemyHealth
    }
    base.hydrated = true
  }

  return { ...base, ...derive(base) }
})()

export const useGameStore = create((set, get) => ({
  ...initial,

  /* ---------------------------------------------------------------- combat */

  /**
   * A player click. "point" is the world-space impact position (for 3D
   * particles) and "screen" the client pixel coordinates (for DOM floating
   * text), so both effect layers can spawn exactly where the tap landed.
   */
  attack(point, screen) {
    const s = get()
    const now = performance.now()
    const combo =
      now - s.lastClickAt < COMBO_WINDOW_MS ? Math.min(MAX_COMBO, s.comboCount + 1) : 0
    const crit = Math.random() < s.critChance
    const damage = crit ? s.clickPower * CRIT_MULTIPLIER : s.clickPower

    /*
     * Every click makes the dino permanently stronger by its own damage, in
     * the hub as well as the arena. This sits in `attack` rather than in the
     * damage pipeline on purpose: swinging is what trains you, whether or not
     * there is anything in front of you to hit.
     */
    const gain = EVOLUTIONS[s.evolutionIndex]?.power ?? 1
    const battlePower = s.battlePower + gain

    set({
      comboCount: combo,
      lastClickAt: now,
      battlePower,
      ...derive({ ...s, battlePower }),
    })
    // Announced separately from the blow that lands, because the growth
    // happens whether or not there was anything in front of you to hit.
    emit(EVENTS.DAMAGE_GAIN, { gain, screen })
    get()._applyDamage(damage, { source: 'click', crit, combo, point, screen })
  },

  /**
   * Passive damage. The idle system batches whole frames and calls this at a
   * fixed low rate rather than writing state sixty times a second.
   */
  idleTick(amount) {
    if (amount <= 0) return
    get()._applyDamage(amount, { source: 'idle', crit: false, combo: 0 })
  },

  /** Shared damage pipeline for both click and idle sources. */
  _applyDamage(damage, meta) {
    const s = get()
    // A cleared chamber sits at zero health, and a pending one is already on
    // its way there. Without this guard any further hit would fall straight
    // through to _clearStage and pay out again.
    const blocked = s.stageCleared || s.clearPending || s.dead

    /*
     * A click still swings even here - the animation, the hit particles, the
     * floating number - exactly like clicking against nothing in the hub. Only
     * the combat math below (and the payout it can trigger) is guarded; idle
     * ticks have no swing to show and are left exactly as blocked as before,
     * since nobody is watching for an idle tick's animation.
     */
    if (meta.source === 'click' || !blocked) {
      emit(EVENTS.HIT, {
        damage,
        crit: meta.crit,
        combo: meta.combo ?? 0,
        source: meta.source,
        point: meta.point,
        screen: meta.screen,
        maxHealth: stageHealth(s.stageIndex),
      })
    }

    if (blocked) return

    /*
     * One blow can finish the dino in front of you and no more.
     *
     * The pack shares a single health pool, so without a ceiling a player who
     * had over-levelled a stage removed the whole pool in one hit and five
     * dinos dropped together the instant they walked in - no fight at all, and
     * no chance for the pack to land a bite. The cap is one enemy's share of
     * the pool, with a floor so a lone boss still takes a few swings.
     *
     * It only ever binds when you are over-geared: at the level's own gate
     * your damage is well under it, and nothing here changes.
     */
    const max = stageHealth(s.stageIndex)
    const slots = Math.max(1, enemyCountForStage(s.stageIndex, isBoss(s.stageIndex)))

    /*
     * Blows land in proportion to how ready you are for the level.
     *
     * The number on the gate has to mean something. Any gate can be walked
     * through, so the level itself has to be the test - and it was not much of
     * one while an under-geared dino hit for its full damage and merely needed
     * longer. Squared, so the shortfall bites: at half the bar a blow lands a
     * quarter, and against a pack biting at the rate a level you have no
     * business in bites, the arithmetic runs out long before the pack does.
     *
     * Meeting the bar is full damage and there is no bonus above it - the raw
     * click power already grows, so this only ever takes away.
     */
    const readiness = Math.min(1, s.clickPower / recommendedDamage(s.stageIndex))
    const landed = damage * readiness * readiness

    const applied = Math.min(landed, max / Math.max(slots, MIN_HITS_TO_CLEAR))

    const remaining = s.enemyHealth - applied

    if (remaining > 0) {
      set({ enemyHealth: remaining })
      return
    }

    /*
     * The kill lands now - the pool empties and the pack starts falling
     * immediately - but the exit itself does not unseal for another beat.
     * `stageCleared` is what every gate, headline and Return pad actually
     * reads, so holding it back this long is what keeps the exit sealed for
     * exactly as long as the last enemy is still visibly dying.
     *
     * The stage is captured now rather than read again when the timer fires:
     * retreating is always allowed, even mid-death-animation, and a step back
     * into the previous chamber during this window must not clear the one you
     * just walked out of.
     */
    const clearedIndex = s.stageIndex
    set({ enemyHealth: 0, clearPending: true })
    setTimeout(() => {
      const now = get()
      if (now.dead || !now.clearPending || now.stageIndex !== clearedIndex) return
      now._clearStage()
    }, CLEAR_DELAY_MS)
  },

  /**
   * The chamber is clear: pay out and unseal the exit.
   *
   * Clearing no longer advances the stage on its own. The level ahead is
   * reached by walking through the gate, which is where the damage check
   * happens - so the payout and the journey stay separate events.
   */
  _clearStage() {
    const s = get()
    const clearedIndex = s.stageIndex
    const boss = isBoss(clearedIndex)
    const reward = stageReward(clearedIndex)

    const atEnd = clearedIndex >= MAX_STAGES - 1
    // Winning a fight is worth real power, and the deeper the fight the more
    // it is worth - that is what keeps the climb ahead of the entry gates.
    const battlePower = s.battlePower + damageForClear(clearedIndex)

    set({
      // Wins are carried, not banked. They only become spendable when you
      // step on a Return pad or walk back out of the arena - which is what
      // makes pressing deeper a real gamble.
      runWins: s.runWins + reward,
      enemyHealth: 0,
      stageCleared: true,
      clearPending: false,
      // Written down for the rest of the run: this chamber is done, and
      // walking back through it later must not stand the pack up again.
      chamberHealth: { ...s.chamberHealth, [clearedIndex]: 0 },
      bestStage: atEnd ? s.bestStage : Math.max(s.bestStage, clearedIndex + 1),
      battlePower,
      // A clear patches you up, but never all the way: press on deep enough
      // and you arrive at the next pack already hurt.
      playerHealth: Math.min(MAX_PLAYER_HEALTH, s.playerHealth + CLEAR_HEAL),
      ...derive({ ...s, battlePower }),
    })

    emit(EVENTS.STAGE_CLEAR, { stageIndex: clearedIndex, boss, reward, atEnd })
  },

  /* ---------------------------------------------------------------- levels */

  /**
   * Travel to a specific stage.
   *
   * Levels open in order and each one also demands a minimum click damage, so
   * a player cannot skip ahead into a wall they have no way of breaking. The
   * gate lives in data/stages.js; this action only enforces the answer.
   */
  /**
   * Start a fresh arena run.
   *
   * Every trip begins at Stage 1. Progress inside the arena is a *run*, not a
   * checkpoint: what you keep is the Wins you carry out, not the level you
   * reached.
   */
  enterArena() {
    const s = get()
    set({
      scene: 'arena',
      stageIndex: 0,
      enemyHealth: stageHealth(0),
      stageCleared: false,
      clearPending: false,
      // A new trip is a new corridor: every chamber is stocked again.
      chamberHealth: {},
      runWins: 0,
      dead: false,
      playerHealth: MAX_PLAYER_HEALTH,
      areaIndex: 0,
    })
    /*
     * Put down where you already are, in the arena's own numbers.
     *
     * You walk in over the top of the hub's ramp, which is the same physical
     * spot as the far edge of the arena's landing - so converting the position
     * rather than spawning you in the middle of the chamber is the whole
     * difference between stepping through a doorway and being teleported.
     */
    const [ax, az] = hubToArena(playerPosition.x, playerPosition.z)
    // A step inside, so the arena's own way-out trigger is behind you.
    placePlayer([ax, 0, az - SEAM_MARGIN], playerFacing.angle, { markTeleport: false })

    if (s.areaIndex !== 0) emit(EVENTS.AREA_CHANGE, { from: s.areaIndex, to: 0 })
    emit(EVENTS.SCENE_CHANGE, { scene: 'arena' })
    emit(EVENTS.STAGE_ENTER, { stageIndex: 0, fresh: true })
    return true
  },

  /**
   * Bank the run's Wins and go back to the hub.
   *
   * Called by the Return pads at the end of a cleared level, and by walking
   * back out of the arena entrance.
   */
  /**
   * `walked` is true when you carried yourself out through the mouth, and
   * false when a Return pad cashed you out from deep in the corridor. One is a
   * step over a line and should land you exactly where you were; the other is
   * a trip home and lands you at the hub's front door.
   */
  claimRunWins({ walked = false } = {}) {
    const s = get()
    const carried = s.runWins
    const totalWins = s.totalWins + carried
    const nextUnlocked = evolutionIndexForWins(totalWins)
    /*
     * Unlocking a tier never equips it. Walking out of the arena with enough
     * Wins opens the podium; stepping up to that podium and choosing it is a
     * separate act, and it should be, because a dino is the rate your damage
     * grows at rather than a strictly-better hat.
     */
    const nextEquipped = s.equippedIndex

    const next = { ...s, totalWins, unlockedIndex: nextUnlocked, equippedIndex: nextEquipped }

    set({
      wins: s.wins + carried,
      totalWins,
      lifetimeWins: s.lifetimeWins + carried,
      runWins: 0,
      unlockedIndex: nextUnlocked,
      equippedIndex: nextEquipped,
      scene: 'lobby',
      stageIndex: 0,
      enemyHealth: stageHealth(0),
      stageCleared: false,
      clearPending: false,
      chamberHealth: {},
      // Walking out of the arena patches the dino up for the next run.
      playerHealth: MAX_PLAYER_HEALTH,
      areaIndex: 0,
      ...derive(next),
    })

    /*
     * Put down at the arena's doorway, not left wherever the arena's own
     * coordinates happened to fall. Walking out of Stage 1 leaves you around
     * z=+10 in arena space, which is *inside* the hub's bounds - so the hub's
     * own "are you lost?" check saw nothing wrong and you simply appeared
     * standing in the middle of the plaza.
     */
    if (walked) {
      const [hx, hz] = arenaToHubPoint(playerPosition.x, playerPosition.z)
      // Likewise: a step down the ramp, clear of the hub's way-in trigger.
      placePlayer([hx, 0, hz + SEAM_MARGIN], playerFacing.angle)
    } else {
      placePlayer(HUB_ARRIVAL.position, HUB_ARRIVAL.angle)
    }

    emit(EVENTS.CLAIM_WINS, { wins: carried })
    emit(EVENTS.SCENE_CHANGE, { scene: 'lobby' })

    const nextEffective = get().evolutionIndex
    if (nextEffective > s.evolutionIndex) {
      emit(EVENTS.EVOLVE, {
        from: EVOLUTIONS[s.evolutionIndex],
        to: EVOLUTIONS[nextEffective],
      })
    }
    return carried
  },

  /**
   * Step from the level you are in into the one next door.
   *
   * The corridor is one continuous strip of ground and this is the only thing
   * that moves you along it, in either direction. Which way you are going is
   * the whole difference between the two halves of the arena:
   *
   * - Forward is the gamble. The level ahead states a damage requirement and
   *   walking in under it kills the dino; the sign over the gate says so in
   *   red before you step through.
   * - Back is always safe, and always allowed - even out of a fight you are
   *   losing. The chamber behind you is found exactly as you left it, so a
   *   level you already cleared stays cleared for the whole run and its pack
   *   does not stand back up behind you.
   *
   * `nextIndex` below zero means walking out of the near end of Stage 1,
   * which is the way out of the arena.
   */
  travelToStage(nextIndex) {
    const s = get()
    if (s.dead || s.scene !== 'arena') return false
    if (nextIndex === s.stageIndex) return true

    if (nextIndex < 0) {
      // Walked out over the mouth, so keep the position across the seam.
      get().claimRunWins({ walked: true })
      return true
    }
    if (nextIndex >= MAX_STAGES) {
      emit(EVENTS.DENIED, { reason: 'complete' })
      return false
    }

    const forward = nextIndex > s.stageIndex
    const chamberHealth = rememberChamber(s)

    /*
     * Any gate can be walked through.
     *
     * Stepping into a level you were underpowered for used to kill the dino on
     * the spot, before it had swung once - which made the requirement a wall
     * with a trap behind it rather than something to test yourself against.
     * The pack is the wall now: bite damage already scales with how the level
     * rates against your click power, so a chamber you have no business in
     * chews through you in seconds. Lose that fight and you wake up in the hub,
     * the same as any other death - and until you do, you can always turn round
     * and walk back out the way you came.
     */
    const remaining = chamberRemaining(chamberHealth, nextIndex)
    const nextArea = areaIndexForStage(nextIndex)

    set({
      chamberHealth,
      stageIndex: nextIndex,
      enemyHealth: remaining,
      stageCleared: remaining <= 0,
      areaIndex: nextArea,
      bestStage: Math.max(s.bestStage, nextIndex),
    })

    emit(EVENTS.STAGE_ENTER, { stageIndex: nextIndex, retreat: !forward })
    if (nextArea !== s.areaIndex) {
      emit(EVENTS.AREA_CHANGE, { from: s.areaIndex, to: nextArea })
    }
    return true
  },

  /**
   * The pack got its teeth into you.
   *
   * Called from the arena's own frame loop, batched rather than per bite, so a
   * fight is not writing store state sixty times a second. Health at or below
   * zero is death - the run is over and everything carried is gone.
   */
  hurtPlayer(amount) {
    const s = get()
    if (s.dead || amount <= 0) return

    const playerHealth = s.playerHealth - amount
    if (playerHealth > 0) {
      set({ playerHealth })
      emit(EVENTS.PLAYER_HURT, { amount, health: playerHealth, max: MAX_PLAYER_HEALTH })
      return
    }

    set({ playerHealth: 0 })
    emit(EVENTS.PLAYER_HURT, { amount, health: 0, max: MAX_PLAYER_HEALTH })
    get()._killPlayer({ cause: 'slain', stageIndex: s.stageIndex })
  },

  /** Health creeping back once nothing has bitten you for a moment. */
  healPlayer(amount) {
    const s = get()
    if (s.dead || amount <= 0 || s.playerHealth >= MAX_PLAYER_HEALTH) return
    set({ playerHealth: Math.min(MAX_PLAYER_HEALTH, s.playerHealth + amount) })
  },

  /**
   * Your dino fell.
   *
   * There is only one way now: the pack in the level you were standing in wore
   * you down. Walking through a gate underpowered used to be the other, and
   * killed you before you had swung - the level itself is the test instead.
   */
  _killPlayer(reason) {
    const s = get()
    if (s.dead) return
    // Everything carried this run is lost. That is the whole reason the
    // Return pads are worth stepping on.
    /*
     * Nothing reads a stored reason any more. There was a panel that spelled
     * out what had happened and what it cost; the fall says the first and the
     * DEATH event below carries the second to the floating numbers, which is
     * where every other number in this game is read.
     */
    set({ dead: true, runWins: 0, playerHealth: 0 })
    emit(EVENTS.DEATH, { ...reason, lostWins: s.runWins })
  },

  /** Back to the hub to train, with the cleared level still cleared. */
  respawn() {
    set({
      dead: false,
      scene: 'lobby',
      stageIndex: 0,
      enemyHealth: stageHealth(0),
      stageCleared: false,
      clearPending: false,
      chamberHealth: {},
      runWins: 0,
      playerHealth: MAX_PLAYER_HEALTH,
      areaIndex: 0,
    })
    // Dying puts you at the same doorway a finished run does.
    placePlayer(HUB_ARRIVAL.position, HUB_ARRIVAL.angle)
    emit(EVENTS.RESPAWN)
    emit(EVENTS.SCENE_CHANGE, { scene: 'lobby' })
  },

  goToStage(stageIndex) {
    const s = get()
    const gate = canEnterStage(stageIndex, {
      bestStage: s.bestStage,
      clickPower: s.clickPower,
    })

    if (!gate.allowed) {
      emit(EVENTS.DENIED, { reason: gate.reason, stageIndex, required: gate.required })
      return false
    }
    if (stageIndex === s.stageIndex && s.scene === 'arena') return true

    const nextArea = areaIndexForStage(stageIndex)
    set({
      stageIndex,
      enemyHealth: stageHealth(stageIndex),
      stageCleared: false,
      clearPending: false,
      chamberHealth: {},
      dead: false,
      areaIndex: nextArea,
      scene: 'arena',
    })

    if (nextArea !== s.areaIndex) {
      emit(EVENTS.AREA_CHANGE, { from: s.areaIndex, to: nextArea })
    }
    return true
  },

  /* -------------------------------------------------------------- upgrades */

  buyUpgrade(id) {
    const s = get()
    const def = UPGRADES[id]
    if (!def) return false
    const level = s.upgradeLevels[id] ?? 0
    if (level >= def.maxLevel) {
      emit(EVENTS.DENIED, { reason: 'maxed', id })
      return false
    }
    const cost = upgradeCost(id, level)
    if (s.wins < cost) {
      emit(EVENTS.DENIED, { reason: 'cost', id, cost })
      return false
    }

    const upgradeLevels = { ...s.upgradeLevels, [id]: level + 1 }
    set({ wins: s.wins - cost, upgradeLevels, ...derive({ ...s, upgradeLevels }) })
    emit(EVENTS.PURCHASE, { id, level: level + 1, cost })
    return true
  },

  /** Buy as many levels as the current Wins balance allows. */
  buyUpgradeMax(id) {
    let bought = 0
    while (get().buyUpgrade(id)) bought++
    return bought
  },

  /* --------------------------------------------------------------- rebirth */

  canRebirth() {
    return get().totalWins >= REBIRTH_WINS_REQUIRED
  },

  rebirth() {
    const s = get()
    if (s.totalWins < REBIRTH_WINS_REQUIRED) {
      emit(EVENTS.DENIED, { reason: 'rebirth' })
      return false
    }
    const rebirths = s.rebirths + 1
    const run = freshRun()
    set({
      ...run,
      rebirths,
      areaIndex: 0,
      comboCount: 0,
      ...derive({ ...s, ...run, rebirths }),
    })
    emit(EVENTS.REBIRTH, { rebirths, multiplier: rebirthMultiplier(rebirths) })
    return true
  },

  /* -------------------------------------------------------------- training */

  /**
   * Commit training progress. The training system batches whole frames and
   * calls this a few times a second, never once per frame.
   */
  trainTick(amount) {
    if (!(amount > 0)) return
    const s = get()
    const trainedPower = s.trainedPower + amount
    set({ trainedPower, ...derive({ ...s, trainedPower }) })
  },

  /* ----------------------------------------------------------------- lobby */

  setScene(scene) {
    if (scene !== 'lobby' && scene !== 'arena') return
    if (get().scene === scene) return
    set({ scene })

    /*
     * Switching by button is a *teleport*, and a teleport has to be landed.
     *
     * This used to flip the flag and nothing else, which is a real bug and not
     * a cosmetic one: the two halves of the world are the same axes slid sixty
     * three units apart, so the position you were standing at in a chamber went
     * on being used unchanged and was now read as a hub coordinate. You did not
     * arrive anywhere - you were simply re-interpreted, sixty three units off,
     * and whatever the plaza clamp made of that is where you turned up.
     *
     * Walking between the two is handled elsewhere and converts properly (see
     * enterArena and the claim path); this is the case where there is no walk
     * to convert, so it gets a defined place to arrive.
     */
    if (scene === 'lobby') placePlayer(HUB_RETURN.position, HUB_RETURN.angle)

    emit(EVENTS.SCENE_CHANGE, { scene })
  },

  /** Equip a tier from its lobby podium. Locked tiers are refused. */
  equipEvolution(index) {
    const s = get()
    if (index === s.equippedIndex) return false
    if (index > s.unlockedIndex || index < 0) {
      emit(EVENTS.DENIED, { reason: 'locked', index })
      return false
    }
    const previous = s.evolutionIndex
    set({ equippedIndex: index, ...derive({ ...s, equippedIndex: index }) })
    emit(EVENTS.PURCHASE, { id: 'evolution', level: index })
    if (index > previous) {
      emit(EVENTS.EVOLVE, { from: EVOLUTIONS[previous], to: EVOLUTIONS[index] })
    }
    return true
  },

  /* -------------------------------------------------------------- settings */

  toggleMute() {
    const muted = !get().muted
    set({ muted })
    return muted
  },

  setQuality(quality) {
    set({ quality })
  },

  toggleAutoFight() {
    const autoFight = !get().autoFight
    set({ autoFight })
    return autoFight
  },

  setPlayerName(playerName) {
    set({ playerName: String(playerName).slice(0, 16) })
  },

  /** Wipe everything, including permanent rebirths. */
  resetSave() {
    const s = get()
    const run = freshRun()
    const wiped = { rebirths: 0, lifetimeWins: 0, bestStage: 0, areaIndex: 0 }
    set({
      ...run,
      ...wiped,
      comboCount: 0,
      ...derive({ ...s, ...run, ...wiped }),
    })
  },
}))

/** Non-reactive read for imperative systems running inside useFrame. */
export const getGameState = useGameStore.getState
