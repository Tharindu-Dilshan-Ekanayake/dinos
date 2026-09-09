import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore.js'

/**
 * A small FPS readout, shown when the Bloxity portal's `show_fps` setting is
 * on (see systems/bloxity.js / store/useGameStore.js's `showFps` field).
 *
 * Counts real animation frames with its own rAF loop rather than reading
 * anything from the R3F render loop, so it doesn't need to live inside the
 * <Canvas> tree. The visible text only updates a couple of times a second -
 * re-rendering a React component every frame just to show a number that
 * changes every frame would be silly on a clicker built to survive rapid
 * clicking (see TopStats' own "select the formatted value" comment).
 */
export default function FpsCounter() {
  const show = useGameStore((s) => s.showFps)
  const [fps, setFps] = useState(0)
  const frames = useRef(0)
  const lastSample = useRef(0)

  useEffect(() => {
    if (!show) return undefined
    let raf
    const tick = (now) => {
      frames.current += 1
      if (!lastSample.current) lastSample.current = now
      const elapsed = now - lastSample.current
      if (elapsed >= 500) {
        setFps(Math.round((frames.current * 1000) / elapsed))
        frames.current = 0
        lastSample.current = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [show])

  if (!show) return null

  return (
    <div className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
      {fps} FPS
    </div>
  )
}
