import { create } from 'zustand'
import {
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  MAX_STAGES,
  canEnterStage,
  isBoss,
  requiredDamage,
  stageHealth,
  stageReward,
} from '../data/stages.js'
import { EVOLUTIONS, evolutionIndexForWins } from '../data/evolutions.js'
import {
  BASE_STRENGTH,
  REBIRTH_WINS_REQUIRED,
  STRENGTH_PER_HIT,
  computeClickPower,
  rebirthMultiplier,
  strengthForClear,
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
import { EVENTS, emit } from '../systems/events.js'
import { loadSave } from '../systems/persistence.js'

const COMBO_WINDOW_MS = 900
const MAX_COMBO = 8

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
    /** Wins carried this arena run, banked only on the way out. */
    runWins: 0,
    /** Damage earned by standing on training pads. Reset by a rebirth. */
    trainedPower: 0,
    /** Damage earned by fighting - every blow landed and every level cleared. */
    battlePower: 0,
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

/** Rebuild derived fields from the raw persisted numbers. */
function derive(state) {
  const evolutionIndex = effectiveEvolution(state.unlockedIndex, state.equippedIndex)
  const evolution = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const strength =
    BASE_STRENGTH +
    strengthFromLevels(state.upgradeLevels.strength) +
    (state.trainedPower ?? 0) +
    (state.battlePower ?? 0)
  const clickPower = computeClickPower(strength, evolution.power, state.rebirths)
  return {
    evolutionIndex,
    strength,
    clickPower,
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
    playerName: '',
    scene: 'lobby',
    // Death is transient: you always come back at the hub.
    dead: false,
    deathReason: null,
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

    set({ comboCount: combo, lastClickAt: now })
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
    // A cleared chamber sits at zero health. Without this guard any further
    // hit would fall straight through to _clearStage and pay out again.
    if (s.stageCleared || s.dead) return

    const remaining = s.enemyHealth - damage

    emit(EVENTS.HIT, {
      damage,
      crit: meta.crit,
      combo: meta.combo ?? 0,
      source: meta.source,
      point: meta.point,
      screen: meta.screen,
      maxHealth: stageHealth(s.stageIndex),
    })

    if (remaining > 0) {
      // Swinging is itself training: every blow that lands grows the dino a
      // little, so time in the arena is never wasted even on a level you end
      // up walking back out of.
      if (meta.source === 'click') {
        const battlePower = s.battlePower + STRENGTH_PER_HIT
        set({ enemyHealth: remaining, battlePower, ...derive({ ...s, battlePower }) })
      } else {
        set({ enemyHealth: remaining })
      }
      return
    }

    get()._clearStage()
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
    const battlePower = s.battlePower + strengthForClear(clearedIndex)

    set({
      // Wins are carried, not banked. They only become spendable when you
      // step on a Return pad or walk back out of the arena - which is what
      // makes pressing deeper a real gamble.
      runWins: s.runWins + reward,
      enemyHealth: 0,
      stageCleared: true,
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
      runWins: 0,
      dead: false,
      deathReason: null,
      playerHealth: MAX_PLAYER_HEALTH,
      areaIndex: 0,
    })
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
  claimRunWins() {
    const s = get()
    const carried = s.runWins
    const totalWins = s.totalWins + carried
    const nextUnlocked = evolutionIndexForWins(totalWins)
    // A player riding the newest tier keeps riding it; one who deliberately
    // equipped an older look from a podium keeps their choice.
    const nextEquipped = s.equippedIndex >= s.unlockedIndex ? nextUnlocked : s.equippedIndex

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
      // Walking out of the arena patches the dino up for the next run.
      playerHealth: MAX_PLAYER_HEALTH,
      areaIndex: 0,
      ...derive(next),
    })

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
   * Walk back out of the near end of a chamber.
   *
   * One level at a time, all the way to Stage 1 - stepping out there banks the
   * run and returns you to the hub. There is no shortcut home.
   */
  retreatStage() {
    const s = get()
    if (s.dead) return false

    if (s.stageIndex <= 0) {
      get().claimRunWins()
      return true
    }

    const previous = s.stageIndex - 1
    const nextArea = areaIndexForStage(previous)
    set({
      stageIndex: previous,
      // A level you already beat this run stays beaten on the way back.
      enemyHealth: 0,
      stageCleared: true,
      areaIndex: nextArea,
    })
    emit(EVENTS.STAGE_ENTER, { stageIndex: previous, retreat: true })
    if (nextArea !== s.areaIndex) {
      emit(EVENTS.AREA_CHANGE, { from: s.areaIndex, to: nextArea })
    }
    return true
  },

  /**
   * Walk through the open exit into the next level.
   *
   * This is the risky path. The level list refuses an entry you cannot
   * survive; the gate lets you walk in and kills you for it, because that is
   * the consequence the arena is built around. The sign over the gate states
   * the requirement in red before you step through.
   */
  enterNextStage() {
    const s = get()
    if (!s.stageCleared || s.dead) return false

    const nextIndex = s.stageIndex + 1
    if (nextIndex >= MAX_STAGES) {
      emit(EVENTS.DENIED, { reason: 'complete' })
      return false
    }

    const required = requiredDamage(nextIndex)
    if (s.clickPower < required) {
      get()._killPlayer({ stageIndex: nextIndex, required, damage: s.clickPower })
      return false
    }

    const nextArea = areaIndexForStage(nextIndex)
    set({
      stageIndex: nextIndex,
      enemyHealth: stageHealth(nextIndex),
      stageCleared: false,
      areaIndex: nextArea,
      bestStage: Math.max(s.bestStage, nextIndex),
    })

    emit(EVENTS.STAGE_ENTER, { stageIndex: nextIndex })
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
   * Your dino fell - either it walked into a level it had no business
   * entering, or the pack in the one it was in wore it down.
   */
  _killPlayer(reason) {
    const s = get()
    if (s.dead) return
    // Everything carried this run is lost. That is the whole reason the
    // Return pads are worth stepping on.
    set({
      dead: true,
      deathReason: { cause: 'underpowered', ...reason, lostWins: s.runWins },
      runWins: 0,
      playerHealth: 0,
    })
    emit(EVENTS.DEATH, { ...reason, lostWins: s.runWins })
  },

  /** Back to the hub to train, with the cleared level still cleared. */
  respawn() {
    set({
      dead: false,
      deathReason: null,
      scene: 'lobby',
      stageIndex: 0,
      enemyHealth: stageHealth(0),
      stageCleared: false,
      runWins: 0,
      playerHealth: MAX_PLAYER_HEALTH,
      areaIndex: 0,
    })
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
      dead: false,
      deathReason: null,
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
