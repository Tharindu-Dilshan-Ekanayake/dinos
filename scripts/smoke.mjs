/**
 * Does the app actually come up?
 *
 * `vite build` only bundles - it resolves no names across modules, so a
 * component referencing an import that was dropped builds perfectly and then
 * throws the moment React renders it, leaving a blank page. That has happened,
 * so this boots the dev server, loads the page in a headless browser and fails
 * on an empty root or on anything written to console.error.
 *
 * Usage: npm run smoke
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 5177
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
  console.error('smoke: no Chrome or Edge found - skipping')
  process.exit(0)
}

const scratch = mkdtempSync(join(tmpdir(), 'dino-smoke-'))
/*
 * The probe lives in the project root, not in a temp directory, because a page
 * loaded over file:// may not import modules from http://localhost - the dev
 * server has to serve both.
 */
const PROBE_NAME = 'smoke-probe.html'
const probe = join(process.cwd(), PROBE_NAME)

/*
 * The probe hosts the app itself rather than loading "/", so console.error can
 * be wrapped before anything imports. React reports a render throw there and
 * nowhere else - window.onerror alone would miss which component broke.
 */
writeFileSync(
  probe,
  `<div id="root"></div>
<pre id="log"></pre>
<script type="module">
  const out = []
  const SEP = String.fromCharCode(10) + '~~~' + String.fromCharCode(10)
  const write = () => { document.getElementById('log').textContent = out.join(SEP) }
  const real = console.error
  console.error = (...a) => { out.push(a.map((x) => (x && x.stack) || String(x)).join(' ')); write(); real(...a) }
  addEventListener('error', (e) => { out.push('ERROR ' + ((e.error && e.error.stack) || e.message)); write() })
  addEventListener('unhandledrejection', (e) => { out.push('REJECT ' + ((e.reason && e.reason.stack) || e.reason)); write() })
  try { await import('http://localhost:${PORT}/src/main.jsx') }
  catch (e) { out.push('IMPORT THREW ' + (e.stack || e.message)); write() }
  await new Promise((r) => setTimeout(r, 3000))
  write()
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

// Wait for the server rather than sleeping a fixed amount.
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

const out = join(scratch, 'dom.html')
const dump = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--enable-unsafe-swiftshader',
    '--virtual-time-budget=20000',
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
writeFileSync(out, dom)

const log = (dom.match(/<pre id="log">([\s\S]*?)<\/pre>/) || [, ''])[1]
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .trim()

if (log) done(1, `smoke: the app logged errors\n\n${log.slice(0, 4000)}`)

const root = dom.slice(dom.indexOf('<div id="root">'))
if (!root.includes('<canvas')) done(1, 'smoke: the app rendered no canvas - root came up empty')

console.log('smoke: the app boots, renders a canvas and logs nothing')
done(0, '')
