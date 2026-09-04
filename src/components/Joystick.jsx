import { useEffect, useRef } from 'react'
import { setStick } from '../systems/input.js'

/**
 * Thumb stick for touch devices.
 *
 * Fully imperative: the knob is moved by writing transforms directly and the
 * vector goes straight into the input module, so dragging it never renders a
 * single React frame. Pointer capture keeps the drag alive even when the
 * thumb slides outside the pad.
 */
const RADIUS = 52

export default function Joystick() {
  const base = useRef(null)
  const knob = useRef(null)

  useEffect(() => {
    const pad = base.current
    const stick = knob.current
    if (!pad || !stick) return

    let activePointer = null

    const apply = (dx, dy) => {
      const distance = Math.hypot(dx, dy)
      const clamped = Math.min(distance, RADIUS)
      const angle = Math.atan2(dy, dx)
      const x = Math.cos(angle) * clamped
      const y = Math.sin(angle) * clamped

      stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
      // Normalised, with a small dead zone so a resting thumb does not drift.
      const magnitude = clamped / RADIUS
      if (magnitude < 0.12) {
        setStick(0, 0)
      } else {
        setStick(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude)
      }
    }

    const reset = () => {
      stick.style.transform = 'translate(-50%, -50%)'
      setStick(0, 0)
    }

    const onDown = (e) => {
      activePointer = e.pointerId
      pad.setPointerCapture(e.pointerId)
      const rect = pad.getBoundingClientRect()
      apply(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2))
      e.stopPropagation()
      e.preventDefault()
    }

    const onMove = (e) => {
      if (e.pointerId !== activePointer) return
      const rect = pad.getBoundingClientRect()
      apply(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2))
      e.stopPropagation()
    }

    const onUp = (e) => {
      if (e.pointerId !== activePointer) return
      activePointer = null
      reset()
      e.stopPropagation()
    }

    pad.addEventListener('pointerdown', onDown)
    pad.addEventListener('pointermove', onMove)
    pad.addEventListener('pointerup', onUp)
    pad.addEventListener('pointercancel', onUp)

    return () => {
      pad.removeEventListener('pointerdown', onDown)
      pad.removeEventListener('pointermove', onMove)
      pad.removeEventListener('pointerup', onUp)
      pad.removeEventListener('pointercancel', onUp)
      setStick(0, 0)
    }
  }, [])

  return (
    <div
      ref={base}
      className="pointer-events-auto relative h-32 w-32 touch-none rounded-full border border-white/20 bg-slate-950/40 backdrop-blur-sm"
      aria-label="Move"
    >
      <div className="absolute inset-4 rounded-full border border-white/10" />
      <div
        ref={knob}
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border border-white/30 bg-white/25 shadow-lg"
        style={{ transform: 'translate(-50%, -50%)' }}
      />
    </div>
  )
}
