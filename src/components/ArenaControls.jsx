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
  // "Area clear" would only be restating the open gate behind it.
  const info = danger || gate?.open ? null : (PROMPTS[prompt?.kind] ?? null)

  return (
    <>
      {/*
        Auto-fight sits top-centre on a wide screen, but a phone's header is
        already two rows of buttons - there it drops down beside the action
        keys, which is better thumb reach anyway. Two explicit slots rather
        than one element juggling responsive position overrides.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 hidden justify-center sm:flex">
        <AutoFightButton on={autoFight} onToggle={toggleAutoFight} />
      </div>
      <div className="pointer-events-none absolute bottom-44 right-4 z-20 flex justify-end sm:hidden">
        <AutoFightButton on={autoFight} onToggle={toggleAutoFight} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 safe-bottom">
        {/*
          What is through the gate is announced over the gate itself, by
          GateHeadline - stage, recommended damage and head-count all. Repeating
          it down here put the same sentence on screen twice, so the banner
          keeps only the half the world cannot safely say: that the level
          through this one is above your weight. It is a warning, not a
          refusal - you may always walk in, and always walk back out.
        */}
        {danger ? (
          <div className="mb-2 flex justify-center px-4">
            <div className="arcade-panel border-amber-400 px-4 py-1.5 text-center">
              <div className="text-sm font-black uppercase tracking-wide text-amber-300">
                You are under-geared for this gate
              </div>
              <div className="text-[11px] font-semibold text-white/60">
                {gate.boss ? 'Boss ' : ''}Stage {gate.stage} is tuned for{' '}
                {formatNumber(gate.required)} damage - the pack there will hit hard.
                Turn back any time.
              </div>
            </div>
          </div>
        ) : (
          info && (
            <div className="mb-2 flex justify-center">
              <div className="arcade-panel px-4 py-1.5 text-center">
                <div className={`text-sm font-black uppercase tracking-wide ${info.tone}`}>
                  {info.text}
                </div>
              </div>
            </div>
          )
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
              className="arcade arcade-blue pointer-events-auto h-16 w-16 rounded-full text-xs"
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
              className="arcade arcade-red pointer-events-auto h-20 w-20 rounded-full text-sm"
            >
              Attack
            </button>
          </div>
        </div>

        <div className="mt-2 hidden justify-center sm:flex">
          <div className="arcade-panel px-3 py-1 text-[11px] text-white/55">
            WASD to walk - Space to jump - click to attack - right-drag to look
          </div>
        </div>
      </div>
    </>
  )
}
