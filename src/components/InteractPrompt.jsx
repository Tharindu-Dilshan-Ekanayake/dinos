import { useEffect, useState } from 'react'
import { EVENTS, on } from '../systems/events.js'
import { queueInteract } from '../systems/input.js'

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
 */
export default function InteractPrompt() {
  const [prompt, setPrompt] = useState(null)

  useEffect(() => on(EVENTS.PROMPT, setPrompt), [])
  // Whatever you were standing next to, you are not standing next to it in the
  // other half of the game.
  useEffect(() => on(EVENTS.SCENE_CHANGE, () => setPrompt(null)), [])

  if (!prompt) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] z-30 flex justify-center px-4">
      <div className="arcade-panel animate-pop-in flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          disabled={!prompt.enabled}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (prompt.enabled) queueInteract()
          }}
          className={`arcade pointer-events-auto h-11 w-11 shrink-0 text-lg ${
            prompt.enabled ? 'arcade-green' : 'arcade-slate opacity-60'
          }`}
        >
          E
        </button>

        <div className="min-w-0">
          <div className="truncate text-sm font-black uppercase tracking-wide text-white/90">
            {prompt.title}
          </div>
          <div
            className={`text-[0.7rem] font-black uppercase tracking-wider ${
              prompt.enabled ? 'text-emerald-300' : 'text-white/45'
            }`}
          >
            {prompt.enabled ? `Press E to ${prompt.action}` : prompt.action}
          </div>
        </div>
      </div>
    </div>
  )
}
