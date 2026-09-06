import { useMemo } from 'react'
import { useGameStore } from '../store/useGameStore.js'
import { qualitySettings } from './quality.js'

/**
 * The graphics preset in force, resolved from the player's saved choice.
 *
 * A hook rather than a module-level value because 'auto' has to be resolved
 * once, at render, and because changing the setting has to re-render whatever
 * is drawing itself differently because of it.
 */
export function useQuality() {
  const choice = useGameStore((s) => s.quality)
  return useMemo(() => qualitySettings(choice), [choice])
}
