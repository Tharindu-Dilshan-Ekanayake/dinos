import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene.jsx'
import UIOverlay from './components/UIOverlay.jsx'
import LoadingVeil from './components/LoadingVeil.jsx'
import { unlockAudio } from './systems/audio.js'
import { useQuality } from './systems/useQuality.js'
import { useGameStore } from './store/useGameStore.js'

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
        gl={{
          antialias: quality.antialias,
          powerPreference: 'high-performance',
          // Keeps depth precision usable across the long stage corridor.
          logarithmicDepthBuffer: true,
        }}
        /*
         * The far plane has to clear the skydome, which now sits well past the
         * fog so that three chambers of corridor can be seen in front of it.
         * At the old 140 the far end of the corridor was simply clipped away.
         */
        /*
         * `near` at 0.5, not 0.1.
         *
         * The depth buffer's precision is spent according to the ratio between
         * the near and far planes, and almost all of it goes to the first few
         * units. At 0.1/460 that ratio is 4600:1 and surfaces a few centimetres
         * apart forty units away - a path lying on paving, a lily pad on water,
         * a marking on a dino - land in the same depth bucket and tear against
         * each other as the camera moves. That is the flicker.
         *
         * Nothing is ever within half a unit of this camera: it orbits the
         * player at ten units minimum. So this is five times the precision
         * everywhere, for nothing.
         */
        camera={{ position: [0, 3.1, 12.2], fov: 40, near: 0.5, far: 460 }}
        onCreated={(state) => {
          // A handle for scripts/budget.mjs, which measures draw calls and
          // triangles in a real browser. `import.meta.env.DEV` is a literal at
          // build time, so this block is not in the shipped bundle at all.
          if (import.meta.env.DEV) {
            window.__scene = state
            /*
             * The store, from *this* module instance.
             *
             * A script that imports the store by URL can end up with a second
             * copy - Vite gives the app's own import an HMR query string, and a
             * different URL is a different module. Driving that copy changes
             * nothing the app can see, which reads as "the call did nothing"
             * and cost a long diagnosis once already.
             */
            window.__store = useGameStore
          }
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
