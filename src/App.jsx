import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene.jsx'
import UIOverlay from './components/UIOverlay.jsx'
import LoadingVeil from './components/LoadingVeil.jsx'
import { unlockAudio } from './systems/audio.js'
import { useQuality } from './systems/useQuality.js'

export default function App() {
  /*
   * Antialiasing and the shadow map are fixed when the WebGL context is made,
   * so changing the preset remounts the Canvas by way of its key. That costs a
   * reload of the scene, which is why it is a menu setting and not something
   * the game adjusts on its own mid-play.
   */
  const quality = useQuality()

  // Browsers only allow an AudioContext to start from a real user gesture.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <Canvas
        key={quality.id}
        // The whole second render pass, and the first thing to go on a machine
        // that cannot feed the one it already has.
        shadows={quality.shadows}
        // Cap the pixel ratio: phones with dpr 3+ would otherwise render 9x the
        // pixels for no visible gain on a scene this stylised.
        dpr={quality.dpr}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        /*
         * The far plane has to clear the skydome, which now sits well past the
         * fog so that three chambers of corridor can be seen in front of it.
         * At the old 140 the far end of the corridor was simply clipped away.
         */
        camera={{ position: [0, 3.1, 12.2], fov: 40, near: 0.1, far: 460 }}
        onCreated={(state) => {
          // A handle for scripts/budget.mjs, which measures draw calls and
          // triangles in a real browser. `import.meta.env.DEV` is a literal at
          // build time, so this block is not in the shipped bundle at all.
          if (import.meta.env.DEV) window.__scene = state
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      <UIOverlay />
      <LoadingVeil />
    </div>
  )
}
