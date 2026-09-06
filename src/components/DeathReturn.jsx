import { useEffect } from 'react'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Falling sends you straight back to the hub.
 *
 * There used to be a panel here - a skull, a paragraph explaining that the pack
 * had chewed you down, a list of what it cost and a button to acknowledge it.
 * Dying is not news by the time you have watched your own dino topple over, and
 * a modal you have to dismiss makes the cheapest moment in the game the one
 * that asks most of you. What it lost you is thrown up as a floating number
 * like every other number in this game; the hub is where you land.
 *
 * The wait is the death animation, not a pause for reading: ArenaPlayer takes
 * 0.9s to topple and sink, and cutting away mid-fall would leave you in the hub
 * with no idea what happened.
 */
const FALL_SECONDS = 1.15

export default function DeathReturn() {
  const dead = useGameStore((s) => s.dead)
  const respawn = useGameStore((s) => s.respawn)

  useEffect(() => {
    if (!dead) return
    const timer = setTimeout(respawn, FALL_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [dead, respawn])

  return null
}
