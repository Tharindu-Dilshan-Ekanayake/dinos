import { useEffect, useRef, useState } from 'react'
import { formatNumber } from '../data/progression.js'
import { useGameStore } from '../store/useGameStore.js'
import { EVENTS, on } from '../systems/events.js'
import { queueInteract } from '../systems/input.js'
import Joystick from './Joystick.jsx'

/**
 * Live Damage readout.
 *
 * Training commits several times a second, so this reads the store from an
 * rAF loop and writes straight to the DOM rather than subscribing React to a
 * number that changes constantly.
 */
function DamageMeter() {
  const value = useRef(null)

  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      const text = formatNumber(useGameStore.getState().clickPower)
      if (value.current && text !== last) {
        value.current.textContent = text
        last = text
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="hud-panel px-4 py-1.5 text-center">
      <div className="hud-label">Damage</div>
      <div ref={value} className="text-2xl font-black leading-tight text-amber-300" />
    </div>
  )
}

/**
 * Hub controls: the movement stick, the contextual interact button, and the
 * banner that appears while you are training on a pad.
 *
 * The prompt and training state arrive over the event bus from the in-scene
 * proximity scans, so this only re-renders when the target actually changes.
 */
export default function LobbyHUD() {
  const [prompt, setPrompt] = useState(null)
  const [training, setTraining] = useState(null)

  useEffect(() => on(EVENTS.PROMPT, setPrompt), [])
  useEffect(() => on(EVENTS.TRAINING, setTraining), [])

  return (
    <>
      {/* Training banner sits above the controls, out of the thumbs' way. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-40 z-20 flex flex-col items-center gap-2 px-4">
        {training && (
          <div className="hud-panel animate-pop-in border-emerald-300/50 px-5 py-2 text-center">
            <div className="text-lg font-black uppercase tracking-wide text-emerald-300">
              Training x{training.pad.multiplier}
            </div>
            <div className="text-xs font-semibold text-white/70">
              +{formatNumber(training.rate)} damage / sec
            </div>
          </div>
        )}

        {prompt && (
          <div className="hud-panel animate-slide-up px-4 py-2 text-center">
            <div className="text-sm font-black uppercase tracking-wide text-white/90">
              {prompt.title}
            </div>
            <div
              className={`text-[11px] font-semibold ${
                prompt.enabled ? 'text-emerald-300' : 'text-white/45'
              }`}
            >
              {prompt.action}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 safe-bottom">
        <div className="mb-2 flex justify-center">
          <DamageMeter />
        </div>

        <div className="flex items-end justify-between px-4">
          <Joystick />

          <div className="flex flex-col items-end gap-2">
            <div className="hud-panel hidden px-3 py-1.5 text-[11px] text-white/55 sm:block">
              WASD to walk - drag to look - scroll to zoom - E to interact
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                queueInteract()
              }}
              disabled={!prompt?.enabled}
              className="hud-button pointer-events-auto h-20 w-20 rounded-full text-sm font-black uppercase tracking-wide"
            >
              {prompt?.enabled ? prompt.action : 'Interact'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
