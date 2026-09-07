/**
 * What is standing in a given box of the world?
 *
 * Screenshots are how you notice something is wrong and a poor way to work out
 * what. This boots the app, walks the live scene graph, and reports every mesh
 * whose bounding box overlaps a slab of world you name - with its size, its
 * height range and the material it wears, which between them are usually enough
 * to name the thing.
 *
 * Usage: npm run probe -- x minZ maxZ
 *
 * Walks a ray down at (x, z) for every z in the range and prints the height of
 * the first surface it hits - which is the thing the player would be standing
 * on, and the only way to see through an instanced mesh's union bounding box.
 */
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PORT = 5181
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
  console.error('probe: no Chrome or Edge found - skipping')
  process.exit(0)
}

const census = process.env.PROBE_CENSUS === '1'
const bool_scene = process.env.PROBE_SCENE === 'arena' ? 'arena' : 'lobby'
const n = process.argv.slice(2).map(Number)
const box = {
  minX: n[0] ?? -6,
  maxX: n[1] ?? 6,
  minZ: n[2] ?? -60,
  maxZ: n[3] ?? -40,
  minY: n[4] ?? 0.1,
}

const PROBE_NAME = 'probe-probe.html'
const probe = join(process.cwd(), PROBE_NAME)

writeFileSync(
  probe,
  `<style>#root{width:600px;height:340px}body{margin:0}</style>
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
    const three = await import('http://localhost:${PORT}/node_modules/.vite/deps/three.js')
    await import('http://localhost:${PORT}/src/main.jsx')
    const deadline = Date.now() + 25000
    while (Date.now() < deadline) {
      await frames(4)
      if ((window.__scene?.scene.children.length ?? 0) > 1) break
      await sleep(250)
    }
    await frames(60)
    if (${JSON.stringify(bool_scene)} === 'arena') {
      window.__store.getState().enterArena()
      await frames(120)
    }

    const B = ${JSON.stringify(box)}
    window.__scene.scene.updateMatrixWorld(true)

    /*
     * A ray straight down finds the surface you would actually stand on,
     * instanced meshes included - which a bounding box cannot, because an
     * instanced mesh's box is the union of every copy and says nothing about
     * whether any one of them is over the spot you care about.
     */
    const found = []
    if (${JSON.stringify(census)}) {
      /*
       * A census of every instanced mesh: how many copies it holds, whether it
       * has a material at all, and how big a sphere it claims to occupy. An
       * instanced mesh with no material is invisible *and* invisible to a ray,
       * which is exactly the shape of "the data is right but nothing is there".
       */
      found.push({ scene: window.__store.getState().scene, children: window.__scene.scene.children.length })
      window.__scene.scene.traverse((o) => {
        if (!o.isInstancedMesh) return
        let owner = '(unnamed)'
        for (let n = o; n; n = n.parent) {
          if (n.name) { owner = n.name; break }
        }
        found.push({
          owner,
          count: o.count,
          material: o.material ? ([].concat(o.material)[0]?.color?.getHexString?.() ?? '?') : 'MISSING',
          radius: Number((o.boundingSphere?.radius ?? -1).toFixed(1)),
          visible: o.visible,
          culled: o.frustumCulled,
        })
      })
    } else {
      const ray = new three.Raycaster()
      const down = new three.Vector3(0, -1, 0)
      for (let z = B.minZ; z <= B.maxZ; z += 1) {
        ray.set(new three.Vector3(B.minX, 40, z), down)
        const hits = ray.intersectObjects(window.__scene.scene.children, true)
          .filter((h) => h.object.isMesh || h.object.isInstancedMesh)
        const top = hits[0]
        found.push({
          z,
          y: top ? Number((40 - top.distance).toFixed(2)) : null,
          colour: top ? ([].concat(top.object.material)[0]?.color?.getHexString?.() ?? '?') : '-',
          owner: (() => {
            let p = top?.object
            while (p) {
              if (p.name) return p.name
              p = p.parent
            }
            return '(unnamed)'
          })(),
        })
      }
    }
    log.textContent = JSON.stringify(found, null, 0)
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
    '--virtual-time-budget=120000',
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

done(body.startsWith('[') ? 0 : 1, body || 'probe: nothing came back')
