/**
 * What does a frame of this game actually cost?
 *
 * "Make it run on a weak machine" is not a thing you can do by reading code and
 * guessing. This boots the real app in a headless browser, drives it into each
 * scene, and reads the numbers a low-end GPU actually cares about off
 * WebGLRenderer.info: draw calls, triangles, and how many distinct geometries,
 * textures and shader programs are resident.
 *
 * The browser runs on SwiftShader (software rendering), so the millisecond
 * figures are not a phone's - but they are a consistent yardstick, and the
 * draw-call and triangle counts are exact.
 *
 * Usage: npm run budget
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 5178
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
  console.error('budget: no Chrome or Edge found - skipping')
  process.exit(0)
}

const scratch = mkdtempSync(join(tmpdir(), 'dino-budget-'))
const PROBE_NAME = 'budget-probe.html'
const probe = join(process.cwd(), PROBE_NAME)

writeFileSync(
  probe,
  `<style>#root{width:640px;height:360px}</style>
<div id="root"></div>
<pre id="log">running</pre>
<script type="module">
  const log = document.getElementById('log')
  const say = (o) => { log.textContent = JSON.stringify(o, null, 1) }
  /*
   * Frames are stepped by hand rather than waited for. Headless Chrome on
   * SwiftShader never composites, so requestAnimationFrame simply does not
   * fire - r3f exposes advance() for exactly this, and driving it ourselves
   * also means the timing covers a render and nothing else.
   */
  const sleep = () => new Promise((r) => setTimeout(r, 0))
  const frames = async (n) => {
    const t0 = performance.now()
    for (let i = 0; i < n; i++) {
      window.__scene?.advance(performance.now(), true)
      await sleep()
    }
    return (performance.now() - t0) / n
  }

  const report = { step: 'importing' }
  say(report)
  try {
    await import('http://localhost:${PORT}/src/main.jsx')
    report.step = 'imported'; say(report)
    const store = (await import('http://localhost:${PORT}/src/store/useGameStore.js')).useGameStore

    // Give React, the loaders and the first frames time to settle.
    report.step = 'settling'; say(report)
    // Wait for whatever is suspended to resolve rather than guessing a delay.
    const deadline = Date.now() + 25000
    while (Date.now() < deadline) {
      await frames(4)
      if ((window.__scene?.scene.children.length ?? 0) > 1) break
      await new Promise((r) => setTimeout(r, 250))
    }
    await frames(24)
    report.step = 'settled, children=' + (window.__scene?.scene.children.length ?? -1)
    say(report)

    const sample = async (name) => {
      const s = window.__scene
      s.gl.info.autoReset = false
      s.gl.info.reset()
      const frame0 = s.gl.info.render.frame
      const ms = await frames(16)
      const renders = s.gl.info.render.frame - frame0
      report[name] = {
        ms: Number(ms.toFixed(1)),
        renders,
        meshes: (() => { let n = 0; s.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) n++ }); return n })(),
        // Effective visibility: a mesh whose own flag is true still draws
        // nothing if any group above it is hidden.
        visible: (() => {
          let n = 0
          s.scene.traverse((o) => {
            if (!o.isMesh && !o.isInstancedMesh) return
            for (let p = o; p; p = p.parent) if (!p.visible) return
            n++
          })
          return n
        })(),
        calls: Math.round(s.gl.info.render.calls / Math.max(1, renders)),
        triangles: Math.round(s.gl.info.render.triangles / Math.max(1, renders)),
        geometries: s.gl.info.memory.geometries,
        textures: s.gl.info.memory.textures,
        programs: s.gl.info.programs.length,
        objects: (() => { let n = 0; s.scene.traverse(() => n++); return n })(),
        /*
         * Where the draw calls come from. Meshes are grouped by the material
         * they use, because meshes sharing a material are exactly the ones that
         * could have been a single merged draw.
         */
        heaviest: (() => {
          const groups = new Map()
          let casters = 0
          let instanced = 0
          s.scene.traverse((o) => {
            if (!o.isMesh && !o.isInstancedMesh) return
            if (o.isInstancedMesh) instanced++
            if (o.castShadow) casters++
            const m = [].concat(o.material)[0]
            const key = (m?.type ?? '?') + ' #' + (m?.color?.getHexString?.() ?? '------') +
              ' ' + (o.geometry?.type ?? '?')
            const g = groups.get(key) ?? { n: 0, shadow: 0 }
            g.n++
            if (o.castShadow) g.shadow++
            groups.set(key, g)
          })
          // And which named structure each one belongs to.
          const owners = new Map()
          s.scene.traverse((o) => {
            if (!o.isMesh && !o.isInstancedMesh) return
            let p = o
            let name = '(unnamed)'
            while (p) {
              if (p.name) { name = p.name; break }
              p = p.parent
            }
            owners.set(name, (owners.get(name) ?? 0) + 1)
          })

          return {
            casters,
            instanced,
            owners: [...owners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
              .map(([k, v]) => k + ' x' + v),
            top: [...groups.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 4)
              .map(([k, v]) => k + ' x' + v.n + (v.shadow ? ' (' + v.shadow + ' casting)' : '')),
          }
        })(),
      }
      s.gl.info.autoReset = true
    }

    // Each preset in turn. Changing it remounts the Canvas (antialiasing and
    // the shadow map are fixed at context creation), so the scene has to be
    // let settle again before it is worth measuring.
    for (const level of ['high', 'medium', 'low']) {
      store.getState().setQuality(level)
      const until = Date.now() + 20000
      while (Date.now() < until) {
        await frames(4)
        if ((window.__scene?.scene.children.length ?? 0) > 1) break
        await new Promise((r) => setTimeout(r, 250))
      }
      await frames(24)
      await sample('hub-' + level)
    }
    store.getState().setQuality('high')
    await frames(24)
    store.getState().enterArena()
    await frames(24)
    await sample('arena-high')
    store.getState().setQuality('low')
    const until = Date.now() + 20000
    while (Date.now() < until) {
      await frames(4)
      if ((window.__scene?.scene.children.length ?? 0) > 1) break
      await new Promise((r) => setTimeout(r, 250))
    }
    await frames(24)
    await sample('arena-low')
    say(report)
  } catch (e) {
    say({ error: e.stack || String(e) })
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
  rmSync(scratch, { recursive: true, force: true })
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
    '--virtual-time-budget=300000',
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

const body = (dom.match(/<pre id="log">([\s\S]*?)<\/pre>/) || [, ''])[1]
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .trim()

done(body.startsWith('{') && !body.includes('"error"') ? 0 : 1, body || 'budget: no report')
