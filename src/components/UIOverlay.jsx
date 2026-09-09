import { useEffect, useState } from 'react'
import { REBIRTH_WINS_REQUIRED, formatNumber, rebirthMultiplier } from '../data/progression.js'
import { UPGRADE_LIST, upgradeCost } from '../data/upgrades.js'
import { useGameStore } from '../store/useGameStore.js'
import { EVENTS, on } from '../systems/events.js'
import ArenaControls from './ArenaControls.jsx'
import BloxityAccount from './BloxityAccount.jsx'
import BuxShop from './BuxShop.jsx'
import DeathReturn from './DeathReturn.jsx'
import EvolutionTrack from './EvolutionTrack.jsx'
import FloatingTexts from './FloatingTexts.jsx'
import FpsCounter from './FpsCounter.jsx'
import BottomDetails from './BottomDetails.jsx'
import InteractPrompt from './InteractPrompt.jsx'
import Leaderboard from './Leaderboard.jsx'
import LevelSelect from './LevelSelect.jsx'
import LobbyHUD from './LobbyHUD.jsx'
import RebirthModal from './RebirthModal.jsx'
import ScreenFlash from './ScreenFlash.jsx'
import SettingsMenu from './SettingsMenu.jsx'
import StageHeadline from './StageHeadline.jsx'
import UpgradePanel from './UpgradePanel.jsx'
import { useBloxityAuth } from '../systems/useBloxity.js'

/**
 * A count of something you hold.
 *
 * It was a plaque with a caption over a number - "WINS" in 8px above "50K" -
 * which is a spreadsheet cell with a border on it. A trophy hung off the end of
 * a dark lozenge says the same thing without a word in it, reads at arm's
 * length, and survives being shrunk onto a phone, because the icon *is* the
 * label. The caption survives as the tooltip for anyone who wants it spelled
 * out.
 */
function CoinBar({ icon, value, title }) {
  return (
    <div className="coin-bar" title={title}>
      <span className="coin-bar-icon">{icon}</span>
      <span className="arcade-value text-xl leading-none">{value}</span>
    </div>
  )
}

/**
 * One of the big square menu buttons.
 *
 * A picture filling it, its name lettered across the foot, and an optional
 * badge in the corner for anything that wants your attention.
 */
function Tile({ icon, label, color, badge, onPress, className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPress()
      }}
      className={`tile ${color} pointer-events-auto w-full ${className || 'h-[5.2rem]'}`}
    >
      <span className="tile-icon pb-4 text-4xl">{icon}</span>
      <span className="tile-label text-[0.82rem]">{label}</span>
      {badge != null && <span className="tile-badge">{badge}</span>}
    </button>
  )
}

function TopStats() {
  const wins = useGameStore((s) => s.wins)
  const rebirths = useGameStore((s) => s.rebirths)
  /*
   * Damage moves on every single click now, so these select the *formatted
   * text* rather than the raw number: React then re-renders only when what is
   * on screen actually changes, instead of once per tap forever.
   */
  const damage = useGameStore((s) => formatNumber(s.clickPower))
  const idle = useGameStore((s) => (s.idleDps > 0 ? formatNumber(s.idleDps) : ''))
  const runWins = useGameStore((s) => s.runWins)
  const scene = useGameStore((s) => s.scene)

  return (
    <div className="flex flex-col items-start gap-1.5">
      <CoinBar icon="🏆" value={formatNumber(wins)} title="Wins" />
      <CoinBar icon="💪" value={damage} title="Damage per click" />
      {scene === 'arena' && (
        <CoinBar icon="🎒" value={formatNumber(runWins)} title="Wins carried this run" />
      )}
      {rebirths > 0 && (
        <CoinBar
          icon="♻️"
          value={`x${rebirthMultiplier(rebirths).toFixed(1)}`}
          title="Rebirth multiplier"
        />
      )}
      {idle && <CoinBar icon="🌀" value={`${idle}/s`} title="Idle damage" />}
    </div>
  )
}

function RebirthBar({ onOpen }) {
  const totalWins = useGameStore((s) => s.totalWins)
  const rebirths = useGameStore((s) => s.rebirths)
  const ready = totalWins >= REBIRTH_WINS_REQUIRED
  const progress = Math.min(1, totalWins / REBIRTH_WINS_REQUIRED)

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className={`arcade pointer-events-auto relative h-11 w-full justify-between overflow-hidden px-3 ${
        ready ? 'arcade-purple' : 'arcade-slate'
      }`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-white/25"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative text-sm">
        {ready ? 'Rebirth Ready' : 'Rebirth'}
      </span>
      <span className="relative text-xs opacity-90">
        {ready
          ? `x${rebirthMultiplier(rebirths + 1).toFixed(1)} next`
          : `${formatNumber(totalWins)} / ${formatNumber(REBIRTH_WINS_REQUIRED)}`}
      </span>
    </button>
  )
}

/*
 * There is no stage-progress plaque, and no area panel.
 *
 * Between them they put four readouts in two corners: the pack's health, your
 * health, the biome's name and how far through the seventy-five levels you
 * were. Every one of them is true and none of them is *looked at* - during a
 * fight the eye is on the dino you are hitting, and between fights it is on the
 * gate. The pack already carries a bar over each enemy's head, the stage number
 * is lettered across the gate you are walking to, and your own health has moved
 * into the block at the bottom where the rest of your state already lives.
 *
 * What the corners buy by being empty is the thing the reference has and this
 * did not: you can see the game.
 */

/** Shop sheet, opened from the header so it never fights the joystick. */
function ShopSheet({ open, onClose, onRebirth }) {
  if (!open) return null

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg animate-slide-up space-y-1.5 pb-2">
        <EvolutionTrack />
        <UpgradePanel />
        <RebirthBar onOpen={onRebirth} />
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="hud-button h-11 w-full text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}

/**
 * HUD shell.
 *
 * `pointer-events-none` on the frame lets taps fall through to the canvas -
 * which is how you attack in the arena - while each control opts itself back
 * in with `pointer-events-auto`. Everything interactive sits at the bottom of
 * the screen, inside thumb reach on a phone.
 */
export default function UIOverlay() {
  const scene = useGameStore((s) => s.scene)
  const [rebirthOpen, setRebirthOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [buxOpen, setBuxOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [levelsOpen, setLevelsOpen] = useState(false)

  // A rebirth pedestal in the hub opens the same guarded modal as the HUD.
  useEffect(() => on(EVENTS.OPEN_REBIRTH, () => setRebirthOpen(true)), [])

  // The sheet belongs to whichever scene opened it.
  useEffect(() => {
    setShopOpen(false)
  }, [scene])

  // The level list only makes sense while fighting.
  useEffect(() => {
    if (scene === 'lobby') setLevelsOpen(false)
  }, [scene])

  const inLobby = scene === 'lobby'
  const setScene = useGameStore((s) => s.setScene)

  /*
   * The red dot on Store, and the percentage on Rebirth.
   *
   * Both are selected as the finished value - a boolean and a whole number -
   * rather than as the wins behind them, so a HUD that sits over a fight does
   * not re-render on every point of damage that lands.
   */
  const canBuy = useGameStore((s) =>
    UPGRADE_LIST.some((u) => s.wins >= upgradeCost(u.id, s.upgradeLevels[u.id] ?? 0))
  )
  const rebirthPercent = useGameStore((s) =>
    Math.min(100, Math.floor((s.totalWins / REBIRTH_WINS_REQUIRED) * 100))
  )
  // Reactive, unlike calling isBloxityAvailable() directly: the SDK script
  // loads asynchronously, so this can flip from false to true well after
  // this component's first render (see systems/bloxity.js's poll loop).
  const { available: bloxityAvailable } = useBloxityAuth()

  return (
    <>
      <FloatingTexts />
      <ScreenFlash />
      <FpsCounter />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
        <header className="safe-top flex items-start justify-between gap-2 px-3">
          {/*
            The counts, and under them what you are fighting.

            The headline used to be parked at a fixed `top-28`, which is a
            number that was true of a HUD with three small chips in it. Grown
            into full-size coin bars, the column reached past that line and the
            headline came down on top of it. Both live in the same flex column
            now, so the one can never land on the other whatever either is
            carrying.
          */}
          <div className="flex flex-col items-start gap-2">
            <BloxityAccount />
            <TopStats />
            {!inLobby && <StageHeadline />}
          </div>
          {/*
            The menu block: one wide tile leading it, a grid of squares under.

            Laid out the way a shelf of toys is rather than as a row of pills -
            Store first and biggest because it is where everything is bought,
            then the four things you dip into mid-run. On a phone every one of
            them is a thumb-sized square with a picture on it, which is the
            whole reason to build a HUD this way.
          */}
          <div className="flex w-[11.5rem] flex-col items-end gap-2">
            <Tile
              icon="🛒"
              label="Store"
              color="arcade-yellow"
              className="h-[5.8rem]"
              badge={canBuy ? '!' : null}
              onPress={() => setShopOpen((v) => !v)}
            />

            <div className="grid w-full grid-cols-2 gap-2">
              <Tile
                icon="♻️"
                label="Rebirth"
                color="arcade-blue"
                badge={`${rebirthPercent}%`}
                onPress={() => setRebirthOpen(true)}
              />
              {!inLobby && (
                <Tile
                  icon="🗺️"
                  label="Levels"
                  color="arcade-purple"
                  onPress={() => setLevelsOpen((v) => !v)}
                />
              )}
              {!inLobby && (
                <Tile
                  icon="🏠"
                  label="Hub"
                  color="arcade-green"
                  onPress={() => setScene('lobby')}
                />
              )}
              <Leaderboard
                open={boardOpen}
                onToggle={(next) => {
                  setBoardOpen(next)
                  if (next) {
                    setSettingsOpen(false)
                    setBuxOpen(false)
                  }
                }}
              />
              {bloxityAvailable && (
                <BuxShop
                  open={buxOpen}
                  onToggle={(next) => {
                    setBuxOpen(next)
                    if (next) {
                      setBoardOpen(false)
                      setSettingsOpen(false)
                    }
                  }}
                />
              )}
              <SettingsMenu
                open={settingsOpen}
                onToggle={(next) => {
                  setSettingsOpen(next)
                  if (next) {
                    setBoardOpen(false)
                    setBuxOpen(false)
                  }
                }}
              />
            </div>
          </div>
        </header>

        <div />
      </div>

      {inLobby ? <LobbyHUD /> : <ArenaControls />}

      {/* Both scenes now ask for a keypress: the hub for a podium, the arena
          for the Return pad that ends a run. Same panel, same key. */}
      <InteractPrompt />

      {/* Damage, tier and upgrades, in both scenes - clicking earns in both. */}
      <BottomDetails />

      <ShopSheet
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        onRebirth={() => setRebirthOpen(true)}
      />

      <LevelSelect open={levelsOpen} onClose={() => setLevelsOpen(false)} />

      <DeathReturn />

      <RebirthModal open={rebirthOpen} onClose={() => setRebirthOpen(false)} />
    </>
  )
}
