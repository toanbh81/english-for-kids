// Vercel build entry: builds the client, then makes the output available as `dist` both at the
// repo root and inside client/, so the deploy works whether the project's Root Directory is the
// repo root or `client` (the two settings resolve `outputDirectory: dist` differently).
import { execSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const clientDist = join(root, 'client', 'dist')
const rootDist = join(root, 'dist')

execSync('pnpm --filter client build', { cwd: root, stdio: 'inherit' })
if (!existsSync(clientDist)) {
  console.error(`build did not produce ${clientDist}`)
  process.exit(1)
}
rmSync(rootDist, { recursive: true, force: true })
cpSync(clientDist, rootDist, { recursive: true })
console.log(`vercel-build: output ready at ${rootDist} and ${clientDist}`)
