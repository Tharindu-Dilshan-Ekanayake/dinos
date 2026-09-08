import { useEffect, useRef, useState } from 'react'
import { EVENTS, on } from '../systems/events.js'
import { INTERACT_HOLD_SECONDS, isInteractHeld, queueInteract, setInteractHeld } from '../systems/input.js'

/**
 * "Press E" - the call to action for whatever you are standing next to.
 *
 * Parked in the middle of the screen rather than down with the controls,
 * because it is the one prompt a player has to notice: walking up to a podium
 * and not realising the dino is yours for a keypress is the difference between
 * the roster feeling like a shop and feeling like scenery. The arena's Return
 * pads speak through it too - banking a run is the same shape of decision, and
 * it should not be a different control.
 *
 * It rides the same event the hub's proximity scan already emits, so it costs
 * a render only when the thing you are near actually changes. The key cap is
 * also a button, which is what makes it work on a phone with no E to press.
 *
 * A prompt marked `hold` (only the Return pads, currently) does not fire on
 * first touch - it fills a ring around the E cap for as long as the control
 * is held, purely as feedback. The actual decision to fire lives with whoever
 * owns the prompt (ReturnPads.jsx), tracking the identical duration - this
 * component only ever draws what is already true, it never decides it, so a
 * plain keydown (which still queues an instant interact for podiums and
 * rebirth) can never shortcut a hold prompt by riding along underneath it.
 */
export default function InteractPrompt() {
  const [prompt, setPrompt] = useState(null)
  const ringRef = useRef(null)
  const raf = useRef(0)
  const progress = useRef(0)

  useEffect(() => on(EVENTS.PROMPT, setPrompt), [])
  // Whatever you were standing next to, you are not standing next to it in the
  // other half of the game.
  useEffect(() => on(EVENTS.SCENE_CHANGE, () => setPrompt(null)), [])

  // Self-cancelling rAF loop, same shape as ScreenFlash: it only runs while a
  // hold prompt is actually up, so the idle cost for every instant-tap prompt
  // (podium, rebirth) is zero.
  useEffect(() => {
    if (!prompt?.hold || !prompt?.enabled) {
      progress.current = 0
      if (ringRef.current) ringRef.current.style.background = 'transparent'
      return undefined
    }

    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const delta = Math.min(0.05, (now - last) / 1000)
      last = now

      progress.current = isInteractHeld()
        ? Math.min(1, progress.current + delta / INTERACT_HOLD_SECONDS)
        : 0

      if (ringRef.current) {
        const pct = Math.round(progress.current * 100)
        ringRef.current.style.background = `conic-gradient(#7ee06a ${pct}%, rgba(255,255,255,0.22) ${pct}%)`
      }

      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf.current)
  }, [prompt?.hold, prompt?.enabled, prompt?.id])

  if (!prompt) return null

  const releaseHold = () => {
    if (prompt.hold) setInteractHeld(false)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] z-30 flex justify-center px-4">
      <div className="arcade-panel animate-pop-in flex items-center gap-3 px-4 py-2.5">
        <div className="relative h-11 w-11 shrink-0">
          {prompt.hold && (
            <div ref={ringRef} className="pointer-events-none absolute -inset-1 rounded-full" />
          )}
          <button
            type="button"
            disabled={!prompt.enabled}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (!prompt.enabled) return
              if (prompt.hold) setInteractHeld(true)
              else queueInteract()
            }}
            onPointerUp={releaseHold}
            onPointerLeave={releaseHold}
            onPointerCancel={releaseHold}
            className={`arcade pointer-events-auto relative h-11 w-11 text-lg ${
              prompt.enabled ? 'arcade-green' : 'arcade-slate opacity-60'
            }`}
          >
            E
          </button>
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-black uppercase tracking-wide text-white/90">
            {prompt.title}
          </div>
          <div
            className={`text-[0.7rem] font-black uppercase tracking-wider ${
              prompt.enabled ? 'text-emerald-300' : 'text-white/45'
            }`}
          >
            {prompt.enabled
              ? `${prompt.hold ? 'Hold' : 'Press'} E to ${prompt.action}`
              : prompt.action}
          </div>
        </div>
      </div>
    </div>
  )
}
