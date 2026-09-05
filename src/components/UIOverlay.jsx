import { useEffect, useState } from 'react'
import { AREAS, areaProgress } from '../data/areas.js'
import { REBIRTH_WINS_REQUIRED, formatNumber, rebirthMultiplier } from '../data/progression.js'
import { MAX_STAGES } from '../data/stages.js'
import { useGameStore } from '../store/useGameStore.js'
import { EVENTS, on } from '../systems/events.js'
import ArenaControls from './ArenaControls.jsx'
import DeathOverlay from './DeathOverlay.jsx'
import AreaBanner from './AreaBanner.jsx'
import EvolutionTrack from './EvolutionTrack.jsx'
import FloatingTexts from './FloatingTexts.jsx'
import BottomDetails from './BottomDetails.jsx'
import HealthBar from './HealthBar.jsx'
import InteractPrompt from './InteractPrompt.jsx'
import PlayerHealthBar from './PlayerHealthBar.jsx'
import Leaderboard from './Leaderboard.jsx'
import LevelSelect from './LevelSelect.jsx'
import LobbyHUD from './LobbyHUD.jsx'
import RebirthModal from './RebirthModal.jsx'
import ScreenFlash from './ScreenFlash.jsx'
import SettingsMenu from './SettingsMenu.jsx'
import StageHeadline from './StageHeadline.jsx'
import UpgradePanel from './UpgradePanel.jsx'

/** Colourful stat plaque. */
function Chip({ label, value, color = 'arcade-slate', icon }) {
  return (
    <div className={`arcade ${color} flex-col px-2 py-0.5 leading-none sm:px-3 sm:py-1`}>
      <div className="text-[8px] tracking-[0.14em] opacity-90 sm:text-[9px]">{label}</div>
      <div className="arcade-value flex items-center gap-1 text-sm sm:text-lg">
        {icon && <span className="text-[11px] sm:text-sm">{icon}</span>}
        {value}
      </div>
    </div>
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
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      <Chip label="Wins" value={formatNumber(wins)} color="arcade-yellow" icon="🏆" />
      {scene === 'arena' && (
        <Chip label="Carried" value={formatNumber(runWins)} color="arcade-pink" icon="🎒" />
      )}
      <Chip label="Damage" value={damage} color="arcade-red" icon="💪" />
      {idle && <Chip label="Idle" value={`${idle}/s`} color="arcade-blue" icon="🌀" />}
      {rebirths > 0 && (
        <Chip
          label="Rebirth"
          value={`x${rebirthMultiplier(rebirths).toFixed(1)}`}
          color="arcade-purple"
          icon="♻️"
        />
      )}
    </div>
  )
}

function AreaProgress() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const areaIndex = useGameStore((s) => s.areaIndex)
  const area = AREAS[areaIndex] ?? AREAS[0]
  const progress = areaProgress(stageIndex)

  return (
    <div className="arcade-panel px-3 py-1.5 text-center">
      <div className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: area.enemyAccent }}>
        {area.name}
      </div>
      <div className="arcade-value text-xs">
        Stage {stageIndex + 1} / {MAX_STAGES}
      </div>
      <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full border border-black/50 bg-slate-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 transition-[width] duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
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

/**
 * Stage progress, parked under the headline.
 *
 * Each enemy carries its own bar in the world now, so this is the whole
 * stage at a glance rather than a single opponent's health.
 */
function StageProgress() {
  return (
    <div className="pointer-events-none absolute left-3 top-[16.5rem] z-10 w-44 sm:top-[15.5rem]">
      <div className="arcade-panel px-3 py-1.5">
        <HealthBar />
      </div>
      {/* Your own health sits directly under the pack's, so both sides of the
          fight read as one readout. */}
      <div className="arcade-panel mt-1.5 px-3 py-1.5">
        <PlayerHealthBar />
      </div>
    </div>
  )
}

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

  return (
    <>
      <FloatingTexts />
      <ScreenFlash />
      <AreaBanner />
      {!inLobby && <StageHeadline />}

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
        <header className="safe-top flex items-start justify-between gap-2 px-3">
          <TopStats />
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-start justify-end gap-2">
              {!inLobby && (
                <button
                  type="button"
                  aria-label="Hub"
                  className="arcade arcade-green pointer-events-auto h-11 px-3 text-xs"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setScene('lobby')
                  }}
                >
                  Hub
                </button>
              )}
              {!inLobby && (
                <button
                  type="button"
                  aria-label="Levels"
                  className="arcade arcade-yellow pointer-events-auto h-11 px-3 text-xs"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setLevelsOpen((v) => !v)
                  }}
                >
                  Levels
                </button>
              )}
              <button
                type="button"
                aria-label="Shop"
                className="arcade arcade-yellow pointer-events-auto h-11 w-11 text-lg"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setShopOpen((v) => !v)
                }}
              >
                🛒
              </button>
              <Leaderboard
                open={boardOpen}
                onToggle={(next) => {
                  setBoardOpen(next)
                  if (next) setSettingsOpen(false)
                }}
              />
              <SettingsMenu
                open={settingsOpen}
                onToggle={(next) => {
                  setSettingsOpen(next)
                  if (next) setBoardOpen(false)
                }}
              />
            </div>
            {!inLobby && (
              <div className="hidden sm:block">
                <AreaProgress />
              </div>
            )}
          </div>
        </header>

        <div />
      </div>

      {inLobby ? (
        <>
          <LobbyHUD />
          <InteractPrompt />
        </>
      ) : (
        <>
          <StageProgress />
          <ArenaControls />
        </>
      )}

      {/* Damage, tier and upgrades, in both scenes - clicking earns in both. */}
      <BottomDetails />

      <ShopSheet
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        onRebirth={() => setRebirthOpen(true)}
      />

      <LevelSelect open={levelsOpen} onClose={() => setLevelsOpen(false)} />

      <DeathOverlay />

      <RebirthModal open={rebirthOpen} onClose={() => setRebirthOpen(false)} />
    </>
  )
}
