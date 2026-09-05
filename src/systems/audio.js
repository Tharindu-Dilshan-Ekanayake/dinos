/**
 * Web Audio SFX, synthesised at runtime - no audio files ship with the game.
 *
 * The AudioContext is created lazily on the first user gesture (browsers
 * refuse to start one before that) and every voice is a short-lived
 * oscillator/noise burst routed through a shared master gain, so muting is a
 * single gain ramp rather than per-voice bookkeeping.
 */

let ctx = null
let master = null
let muted = false
let noiseBuffer = null

function ensureContext() {
  if (ctx) return ctx
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  ctx = new AudioCtx()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.5
  master.connect(ctx.destination)
  return ctx
}

/** Call from a real user gesture so mobile Safari/Chrome unlock audio. */
export function unlockAudio() {
  const c = ensureContext()
  if (c && c.state === 'suspended') c.resume()
}

export function setMuted(next) {
  muted = next
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(next ? 0 : 0.5, ctx.currentTime, 0.02)
  }
}

export function isMuted() {
  return muted
}

function getNoiseBuffer(c) {
  if (noiseBuffer) return noiseBuffer
  const length = Math.floor(c.sampleRate * 0.4)
  noiseBuffer = c.createBuffer(1, length, c.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

/** One decaying oscillator voice. */
function tone(c, { type = 'sine', from, to, start, duration, gain = 0.3, curve = 'exp' }) {
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  if (to !== undefined && to !== from) {
    if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration)
    else osc.frequency.linearRampToValueAtTime(to, start + duration)
  }
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(gain, start + 0.008)
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(env)
  env.connect(master)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/**
 * Filtered noise burst - the "thwack" body of an impact.
 *
 * `sweepTo` slides the filter over the life of the burst, which is the whole
 * difference between a hit (a fixed band, over in 70ms) and a swing through
 * the air (a band falling away from you).
 */
function noise(c, { start, duration, gain = 0.3, freq = 1800, sweepTo, q = 1, type = 'bandpass' }) {
  const src = c.createBufferSource()
  src.buffer = getNoiseBuffer(c)
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, start)
  if (sweepTo !== undefined && sweepTo !== freq) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), start + duration)
  }
  filter.Q.value = q
  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(gain, start + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(filter)
  filter.connect(env)
  env.connect(master)
  src.start(start)
  src.stop(start + duration + 0.02)
}

/**
 * Impact click. `intensity` 0-1 fattens the hit; `combo` walks the pitch up a
 * pentatonic ladder so fast clicking sounds musical instead of machine-gun.
 */
export function playHit({ intensity = 0.3, combo = 0, crit = false } = {}) {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  const steps = [0, 2, 4, 7, 9, 12, 14, 16]
  const semitone = steps[Math.min(combo, steps.length - 1)]
  const base = 220 * Math.pow(2, semitone / 12)

  noise(c, { start: t, duration: 0.07 + intensity * 0.05, gain: 0.16 + intensity * 0.16, freq: 1200 + intensity * 1600, q: 0.9 })
  tone(c, { type: 'triangle', from: base, to: base * 0.5, start: t, duration: 0.1 + intensity * 0.06, gain: 0.12 + intensity * 0.1 })

  if (crit) {
    tone(c, { type: 'square', from: base * 3, to: base * 6, start: t + 0.01, duration: 0.16, gain: 0.1 })
    noise(c, { start: t, duration: 0.2, gain: 0.1, freq: 4200, q: 2, type: 'highpass' })
  }
}

/**
 * The swing itself, played the moment the button goes down.
 *
 * Separate from playHit on purpose: the swing is the input and the hit is the
 * result, and hearing both is what makes a blow feel like it travelled. A
 * swing that finds nothing still swishes - that is the feedback that you were
 * out of range.
 */
export function playSwing({ heavy = false, connects = true } = {}) {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  const level = connects ? 1 : 0.55

  noise(c, {
    start: t,
    duration: heavy ? 0.26 : 0.18,
    gain: (heavy ? 0.13 : 0.095) * level,
    freq: 2800,
    sweepTo: 520,
    q: 0.8,
  })
  tone(c, {
    type: 'sine',
    from: heavy ? 250 : 330,
    to: 110,
    start: t,
    duration: 0.13,
    gain: 0.055 * level,
  })
}

/**
 * A dino getting its teeth into you: a snap with a growl under it.
 *
 * The pack biting back used to be completely silent - health simply drained
 * while you were looking at the enemy you were hitting rather than the four
 * behind you. This is the warning.
 */
export function playBite({ heavy = false, style = 'snap' } = {}) {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime

  /*
   * Fire is a different animal from teeth: a long roar of filtered noise
   * sweeping *upward* into a crackle, with no snap at the front of it. Hearing
   * which one hit you is half of knowing what is standing behind you.
   */
  if (style === 'fire') {
    noise(c, {
      start: t,
      duration: heavy ? 0.62 : 0.44,
      gain: heavy ? 0.19 : 0.14,
      freq: 320,
      sweepTo: 2600,
      q: 0.7,
    })
    noise(c, {
      start: t + 0.05,
      duration: heavy ? 0.5 : 0.34,
      gain: 0.08,
      freq: 5200,
      q: 1.1,
      type: 'highpass',
    })
    tone(c, {
      type: 'sawtooth',
      from: heavy ? 110 : 150,
      to: 58,
      start: t,
      duration: heavy ? 0.5 : 0.34,
      gain: 0.075,
    })
    return
  }

  noise(c, {
    start: t,
    duration: heavy ? 0.13 : 0.09,
    gain: heavy ? 0.2 : 0.14,
    freq: heavy ? 1600 : 2400,
    sweepTo: heavy ? 220 : 380,
    q: 1.3,
  })
  tone(c, {
    type: 'sawtooth',
    from: heavy ? 140 : 185,
    to: 68,
    start: t,
    duration: heavy ? 0.3 : 0.2,
    gain: 0.1,
  })
  tone(c, { type: 'square', from: 88, to: 54, start: t + 0.02, duration: 0.16, gain: 0.045 })
}

/** Your own dino yelping. Throttled by the caller - bites come in flurries. */
export function playHurt() {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  tone(c, { type: 'sawtooth', from: 420, to: 180, start: t, duration: 0.22, gain: 0.1 })
  noise(c, { start: t, duration: 0.12, gain: 0.07, freq: 1400, sweepTo: 500, q: 0.9 })
}

/**
 * One footfall: a low thud with a scuff of dirt over it.
 *
 * Deliberately the cheapest voice in the file - two nodes, no sweep - because
 * a pack of seven running at you lands a foot every few frames between them.
 * Thinning by distance and by a shared rate limit is the caller's job; see
 * systems/footsteps.js.
 */
export function playFootstep({ intensity = 1, gain = 1, pitch = 1 } = {}) {
  const c = ensureContext()
  if (!c || muted || gain <= 0.02) return
  const t = c.currentTime
  const level = 0.085 * gain * (0.55 + intensity * 0.45)

  tone(c, {
    type: 'sine',
    from: 138 * pitch,
    to: 58 * pitch,
    start: t,
    duration: 0.085,
    gain: level,
  })
  noise(c, {
    start: t,
    duration: 0.05,
    gain: level * 0.5,
    freq: 950 * pitch,
    q: 0.7,
    type: 'lowpass',
  })
}

/** Rising arpeggio + thump when a stage dies. */
export function playStageClear({ boss = false } = {}) {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  const root = boss ? 174.61 : 261.63
  const chord = boss ? [1, 1.2, 1.5, 2, 2.5] : [1, 1.25, 1.5, 2]
  chord.forEach((mult, i) => {
    tone(c, {
      type: 'triangle',
      from: root * mult,
      to: root * mult,
      start: t + i * 0.055,
      duration: 0.34,
      gain: 0.15,
    })
  })
  noise(c, { start: t, duration: boss ? 0.5 : 0.26, gain: boss ? 0.22 : 0.12, freq: 320, q: 0.7, type: 'lowpass' })
  if (boss) tone(c, { type: 'sine', from: 90, to: 40, start: t, duration: 0.6, gain: 0.3 })
}

/** Bright rising sweep + shimmer for an evolution. */
export function playEvolve() {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  tone(c, { type: 'sawtooth', from: 160, to: 1400, start: t, duration: 0.55, gain: 0.14 })
  tone(c, { type: 'sine', from: 320, to: 2400, start: t + 0.04, duration: 0.6, gain: 0.1 })
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(c, { type: 'triangle', from: f, to: f, start: t + 0.3 + i * 0.06, duration: 0.4, gain: 0.13 })
  )
  noise(c, { start: t + 0.28, duration: 0.5, gain: 0.09, freq: 5200, q: 1.4, type: 'highpass' })
}

/** Deep boom + long shimmer for a rebirth. */
export function playRebirth() {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  tone(c, { type: 'sine', from: 130, to: 30, start: t, duration: 1.1, gain: 0.34 })
  tone(c, { type: 'sawtooth', from: 90, to: 900, start: t + 0.05, duration: 0.9, gain: 0.12 })
  noise(c, { start: t, duration: 1.0, gain: 0.16, freq: 900, q: 0.6 })
  ;[392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
    tone(c, { type: 'triangle', from: f, to: f, start: t + 0.35 + i * 0.075, duration: 0.55, gain: 0.12 })
  )
}

/** Short confirmation blip for a purchase. */
export function playPurchase() {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  tone(c, { type: 'square', from: 660, to: 990, start: t, duration: 0.09, gain: 0.1 })
  tone(c, { type: 'sine', from: 990, to: 1320, start: t + 0.06, duration: 0.12, gain: 0.08 })
}

/** Flat buzz when the player cannot afford something. */
export function playDenied() {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  tone(c, { type: 'square', from: 180, to: 120, start: t, duration: 0.16, gain: 0.09 })
}

/** Whoosh when entering a new area. */
export function playAreaChange() {
  const c = ensureContext()
  if (!c || muted) return
  const t = c.currentTime
  noise(c, { start: t, duration: 1.0, gain: 0.14, freq: 700, q: 0.5, type: 'bandpass' })
  tone(c, { type: 'sine', from: 200, to: 700, start: t, duration: 0.8, gain: 0.1 })
  tone(c, { type: 'triangle', from: 523.25, to: 523.25, start: t + 0.5, duration: 0.5, gain: 0.1 })
}
