import { useEffect, useState } from 'react'
import { EVENTS, on } from '../systems/events.js'

/**
 * Covers the canvas until the first frame is on screen, which also hides the
 * gap while Rapier's WASM module streams in.
 */
export default function LoadingVeil() {
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => on(EVENTS.READY, () => setReady(true)), [])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => setGone(true), 500)
    return () => clearTimeout(timer)
  }, [ready])

  if (gone) return null

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-500 ${
        ready ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-5xl">🦖</div>
      <div className="mt-3 text-lg font-black uppercase tracking-[0.3em] text-emerald-300">
        +1 Dino
      </div>
      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">Evolution</div>
    </div>
  )
}
