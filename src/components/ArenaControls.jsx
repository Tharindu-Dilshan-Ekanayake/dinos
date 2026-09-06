import { useCallback, useEffect, useRef, useState } from 'react'
import { formatNumber } from '../data/progression.js'
import { useGameStore } from '../store/useGameStore.js'
import { EVENTS, on } from '../systems/events.js'
import { queueAttack, queueJump } from '../systems/input.js'
import Joystick from './Joystick.jsx'

/**
 * Arena controls: walk, jump, and swing.
 *
 * Laid out like the hub's - stick on the left, actions on the right - so the
 * two scenes never ask the thumbs to relearn anything. The prompt above them
 * comes over the event bus from the in-scene range check, so this only
 * re-renders when the situation actually changes, not every frame.
 */
const PROMPTS = {
  approach: { text: 'Get closer to attack', tone: 'text-amber-300' },
  fight: { text: 'In range - attack!', tone: 'text-emerald-300' },
  clear: { text: 'Area clear', tone: 'text-sky-300' },
}

function AutoFightButton({ on, onToggle }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={on}
      className={`arcade pointer-events-auto h-11 flex-col px-4 leading-none ${
        on ? 'arcade-green' : 'arcade-slate'
      }`}
    >
      <span className="text-xs">Auto Fight</span>
      <span className="text-[10px] opacity-90">{on ? 'ON' : 'OFF'}</span>
    </button>
  )
}

/** Milliseconds between blows while the attack button is held down. */
const HOLD_ATTACK_MS = 260

/**
 * How long the under-geared warning stays up.
 *
 * It is an alert, not a readout: it has one thing to tell you, at the moment a
 * gate opens onto a level above your weight, and after that it is in the way.
 * Long enough to read twice.
 */
const WARNING_MS = 5200

export default function ArenaControls() {
  const [prompt, setPrompt] = useState(null)
  const [gate, setGate] = useState(null)
  const autoFight = useGameStore((s) => s.autoFight)
  const toggleAutoFight = useGameStore((s) => s.toggleAutoFight)
  const holdTimer = useRef(null)

  useEffect(() => on(EVENTS.ARENA_PROMPT, setPrompt), [])
  useEffect(() => on(EVENTS.GATE_PROMPT, setGate), [])

  /*
   * Hold to keep swinging.
   *
   * A tap queued exactly one blow, so fighting on a phone meant hammering the
   * same spot with your thumb for the length of every chamber. The first swing
   * still lands on contact - the repeat is only what your thumb no longer has
   * to do.
   */
  const stopAttacking = useCallback(() => {
    if (holdTimer.current === null) return
    clearInterval(holdTimer.current)
    holdTimer.current = null
  }, [])

  const startAttacking = useCallback(
    (e) => {
      e.stopPropagation()
      queueAttack()
      stopAttacking()
      holdTimer.current = setInterval(queueAttack, HOLD_ATTACK_MS)
    },
    [stopAttacking]
  )

  // A pointer released off the button never fires its own handlers, and a
  // timer left running would swing forever.
  useEffect(() => stopAttacking, [stopAttacking])

  const danger = Boolean(gate?.open && !gate.atEnd && !gate.survivable)
  // "Area clear" would only be restating the open gate behind it. An open gate
  // covers the under-geared case too, since a sealed one cannot be walked into.
  const info = gate?.open ? null : (PROMPTS[prompt?.kind] ?? null)

  /*
   * The warning shows itself and then gets out of the way. Left up it sat
   * permanently on top of the damage panel for the whole of a level you had
   * already decided to walk into.
   */
  const [warning, setWarning] = useState(null)
  useEffect(() => {
    if (!danger) {
      setWarning(null)
      return undefined
    }
    setWarning(gate)
    const timer = setTimeout(() => setWarning(null), WARNING_MS)
    return () => clearTimeout(timer)
    // Re-armed per gate, so walking into the next one warns you again.
  }, [danger, gate?.stage])

  return (
    <>
      {/*
        Auto-fight sits top-centre on a wide screen, but a phone's header is
        already two rows of buttons - there it drops down beside the action
        keys, which is better thumb reach anyway. Two explicit slots rather
        than one element juggling responsive position overrides.
      */}
      <div className="absolute inset-x-0 z-20 justify-center hidden pointer-events-none top-2 sm:flex">
        <AutoFightButton on={autoFight} onToggle={toggleAutoFight} />
      </div>
      <div className="absolute z-20 flex justify-end pointer-events-none bottom-44 right-4 sm:hidden">
        <AutoFightButton on={autoFight} onToggle={toggleAutoFight} />
      </div>

      {/*
        The one thing the world cannot safely say: that the level through this
        gate is above your weight. It is a warning, not a refusal - you may
        always walk in, and always walk back out.

        Up here rather than down in the control stack, where it was wedged
        against the damage panel with the joystick under it. An alert should be
        the thing you look at, not the thing squeezed between two others.
      */}
      {warning && (
        <div className="pointer-events-none absolute inset-x-0 top-[26%] z-30 flex justify-center px-4">
          <div className="arcade-panel animate-pop-in max-w-sm border-amber-400 px-5 py-2.5 text-center">
            <div className="text-base font-black tracking-wide uppercase text-amber-300">
              ⚠ Under-geared for this gate
            </div>
            <div className="mt-0.5 text-[11px] font-semibold leading-relaxed text-white/65">
              {warning.boss ? 'Boss ' : ''}Stage {warning.stage} is tuned for{' '}
              {formatNumber(warning.required)} damage - the pack there will hit hard.
              Turn back any time.
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none safe-bottom">
        {info && (
          <div className="flex justify-center mb-2">
            <div className="arcade-panel px-4 py-1.5 text-center">
              <div className={`text-sm font-black uppercase tracking-wide ${info.tone}`}>
                {info.text}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between px-4">
          <Joystick />

          <div className="flex items-end gap-2">
            <button
              type="button"
              aria-label="Jump"
              onPointerDown={(e) => {
                e.stopPropagation()
                queueJump()
              }}
              className="w-16 h-16 text-xs rounded-full pointer-events-auto arcade arcade-blue"
            >
              Jump
            </button>
            <button
              type="button"
              aria-label="Attack"
              onPointerDown={startAttacking}
              onPointerUp={stopAttacking}
              onPointerLeave={stopAttacking}
              onPointerCancel={stopAttacking}
              className="w-20 h-20 text-sm rounded-full pointer-events-auto arcade arcade-red"
            >
              Attack
            </button>
          </div>
        </div>

        <div className="justify-center hidden mt-2 sm:flex">
          
        </div>
      </div>
    </>
  )
}
