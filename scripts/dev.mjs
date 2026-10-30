// `npm run dev` — starts BOTH processes the app needs:
//   web      Next.js on :3000
//   auction  live auction socket service on :3003 (Bun)
// Without the auction service the room page can never connect.
// Output is prefixed per process; Ctrl+C stops both.
import { spawn } from 'node:child_process'

const procs = [
  { name: 'web', color: 36, cmd: 'next dev -p 3000' },
  { name: 'auction', color: 35, cmd: 'bun --hot mini-services/auction-service/index.ts' },
]

const children = []
let shuttingDown = false

function prefix(name, color, chunk) {
  const tag = `\x1b[${color}m[${name}]\x1b[0m `
  return chunk
    .toString()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => tag + line)
    .join('\n') + '\n'
}

function stopAll(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) if (!c.killed) c.kill()
  setTimeout(() => process.exit(code), 500)
}

for (const p of procs) {
  // shell: true so node_modules/.bin shims (.cmd on Windows) resolve; npm puts them on PATH.
  const child = spawn(p.cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
  child.stdout.on('data', (d) => process.stdout.write(prefix(p.name, p.color, d)))
  child.stderr.on('data', (d) => process.stderr.write(prefix(p.name, p.color, d)))
  child.on('exit', (code) => {
    if (shuttingDown) return
    console.error(prefix(p.name, 31, `exited with code ${code} — stopping everything (the app needs both).`))
    stopAll(code ?? 1)
  })
  children.push(child)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
