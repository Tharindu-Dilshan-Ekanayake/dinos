import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene.jsx'
import UIOverlay from './components/UIOverlay.jsx'
import LoadingVeil from './components/LoadingVeil.jsx'
import { unlockAudio } from './systems/audio.js'

export default function App() {
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
        shadows
        // Cap the pixel ratio: phones with dpr 3+ would otherwise render 9x the
        // pixels for no visible gain on a scene this stylised.
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 3.1, 12.2], fov: 40, near: 0.1, far: 140 }}
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
