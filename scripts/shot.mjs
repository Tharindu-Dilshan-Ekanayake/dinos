/**
 * A picture of the game, from a script.
 *
 * Every other check here is arithmetic - feet land on zero, no two builds are
 * the same animal - and arithmetic cannot tell you whether a dino *looks* like
 * a dino. This boots the real app in a headless browser, points the camera at
 * something, renders a frame and saves it as a PNG.
 *
 * Two things make it work where a plain `--screenshot` does not: headless
 * Chrome never composites, so requestAnimationFrame never fires and r3f's own
 * loop never runs (frames are stepped by hand through `advance`), and the
 * drawing buffer is cleared before a screenshot would be taken (so the canvas
 * is read with toDataURL in the same task as the render that filled it).
 *
 * Usage: npm run shot [name] [x] [y] [z] [targetX] [targetY] [targetZ]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PORT = 5179
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const browser = BROWSERS.find((path) => existsSync(path))
if (!browser) {
  console.error('shot: no Chrome or Edge found - skipping')
  process.exit(0)
}

const [name = 'hub', ...rest] = process.argv.slice(2)
const nums = rest.map(Number)
const eye = nums.length >= 3 ? nums.slice(0, 3) : [0, 6, 26]
const target = nums.length >= 6 ? nums.slice(3, 6) : [0, 2, 8]

/*
 * Which half of the game, and which level. Read here and injected as literals -
 * the probe runs in a browser, where `process` does not exist.
 */
const scene = process.env.SHOT_SCENE === 'arena' ? 'arena' : 'lobby'
const stage = Number(process.env.SHOT_STAGE ?? 0) || 0
const area = Number(process.env.SHOT_AREA ?? 0) || 0

const outDir = join(process.cwd(), 'shots')
mkdirSync(outDir, { recursive: true })

const PROBE_NAME = 'shot-probe.html'
const probe = join(process.cwd(), PROBE_NAME)

writeFileSync(
  probe,
  `<style>#root{width:1100px;height:620px}body{margin:0}</style>
<div id="root"></div>
<pre id="log">running</pre>
<script type="module">
  const log = document.getElementById('log')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const frames = async (n) => {
    for (let i = 0; i < n; i++) {
      window.__scene?.advance(performance.now(), true)
      await sleep(0)
    }
  }
  try {
    await import('http://localhost:${PORT}/src/main.jsx')
    const store = (await import('http://localhost:${PORT}/src/store/useGameStore.js')).useGameStore

    /*
     * Let the hub come up first, whatever we are here to photograph. The scene
     * handle is published from the Canvas's onCreated, and switching scenes
     * before React has mounted one leaves nothing to switch.
     */
    const settle = async () => {
      const deadline = Date.now() + 25000
      while (Date.now() < deadline) {
        await frames(4)
        if ((window.__scene?.scene.children.length ?? 0) > 1) return true
        await sleep(250)
      }
      return false
    }
    if (!(await settle())) throw new Error('the app never mounted a scene')
    await frames(30)

    // A scene and a level to look at, both optional.
    if (${JSON.stringify(scene)} === 'arena') {
      store.getState().enterArena()
      if (${stage} > 0 || ${area} > 0) {
        store.setState({ stageIndex: ${stage}, areaIndex: ${area} })
      }
      /*
       * A level change rebuilds three chambers' worth of geometry and re-runs
       * the biome blend, while the settle check returns straight away because
       * the hub's scene is still standing. So this waits on frames rather than
       * on a condition - too few and the picture is of a half-built level.
       * (No backticks in here: this whole probe is a template literal.)
       */
      await settle()
      await frames(200)
    }

    const s = window.__scene
    if (!s) throw new Error('no scene handle - is this a dev build?')

    /*
     * Camera coordinates are given chamber-local, and the corridor lays every
     * level end to end forty units apart - so Stage 18 is six hundred and
     * eighty units down the -Z axis. Aiming at the world origin instead
     * photographed the empty air where Stage 1 used to be, which comes back as
     * a blank page and looks exactly like a broken renderer.
     */
    const arena = await import('http://localhost:${PORT}/src/data/arena.js')
    const originZ = ${JSON.stringify(scene)} === 'arena' ? arena.chamberOrigin(${stage}) : 0
    s.camera.position.set(${eye[0]}, ${eye[1]}, ${eye[2]} + originZ)
    s.camera.lookAt(${target[0]}, ${target[1]}, ${target[2]} + originZ)
    s.camera.updateProjectionMatrix()

    // Render and read in the same task: the drawing buffer is not preserved,
    // so anything that yields in between hands back a blank canvas.
    s.gl.render(s.scene, s.camera)
    log.textContent = s.gl.domElement.toDataURL('image/png')
  } catch (e) {
    log.textContent = 'ERROR ' + (e.stack || e)
  }
</script>`
)

const server = spawn(
  process.execPath,
  [join('node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'],
  { cwd: process.cwd(), stdio: 'ignore' }
)

const done = (code, message) => {
  server.kill()
  rmSync(probe, { force: true })
  console.log(message)
  process.exit(code)
}

const deadline = Date.now() + 40000
while (Date.now() < deadline) {
  try {
    const res = await fetch(`http://localhost:${PORT}/`)
    if (res.ok) break
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 400))
}

const dump = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--enable-unsafe-swiftshader',
    '--virtual-time-budget=180000',
    '--dump-dom',
    `http://localhost:${PORT}/${PROBE_NAME}`,
  ],
  { stdio: ['ignore', 'pipe', 'ignore'] }
)

let dom = ''
dump.stdout.on('data', (chunk) => {
  dom += chunk
})
await new Promise((resolve) => dump.on('close', resolve))

const body = (dom.match(/<pre id="log">([\s\S]*?)<\/pre>/) || [, ''])[1].trim()
if (!body.startsWith('data:image/png;base64,')) {
  done(1, `shot: no image\n\n${body.slice(0, 2000)}`)
}

const file = join(outDir, `${name}.png`)
writeFileSync(file, Buffer.from(body.slice('data:image/png;base64,'.length), 'base64'))
done(0, `shot: ${file}`)
