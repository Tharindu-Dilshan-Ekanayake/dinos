import { useEffect, useState } from 'react'
import { AREAS } from '../data/areas.js'
import { EVENTS, on } from '../systems/events.js'

/**
 * Sweeping title card when the player crosses into a new area. Mounts a keyed
 * element so the CSS animation replays even on back-to-back transitions.
 */
export default function AreaBanner() {
  const [banner, setBanner] = useState(null)

  useEffect(() => {
    let timer
    const unsubscribe = on(EVENTS.AREA_CHANGE, ({ to }) => {
      const area = AREAS[to]
      if (!area) return
      setBanner({ id: Date.now(), area })
      clearTimeout(timer)
      timer = setTimeout(() => setBanner(null), 3000)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  if (!banner) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/4 z-30 flex justify-center px-4">
      <div key={banner.id} className="area-banner text-center">
        <div className="hud-label text-white/70">Entering</div>
        <div
          className="text-outline text-4xl font-black uppercase tracking-wider sm:text-5xl"
          style={{ color: banner.area.enemyAccent }}
        >
          {banner.area.name}
        </div>
        <div className="mt-1 text-sm font-semibold text-white/60">
          Stages {banner.area.fromStage} - {banner.area.toStage}
        </div>
      </div>
    </div>
  )
}
