// Wires illustrations exported from the Claude Design "Story Art" page into the story JSON.
// Expected files: client/public/images/stories/<storyId>/scene-<n>.(png|jpg|webp)  (n from 1)
// Usage: node scripts/link-story-images.mjs [storyId ...]   (default: all stories)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = new URL('../', import.meta.url)
const p = rel => fileURLToPath(new URL(rel, ROOT))
const storyDir = p('client/src/content/stories/')
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(storyDir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
for (const id of ids) {
  const jsonPath = `${storyDir}${id}.json`
  if (!existsSync(jsonPath)) { console.error(`no story ${id}`); process.exit(1) }
  const story = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const dir = p(`client/public/images/stories/${id}/`)
  const files = existsSync(dir) ? readdirSync(dir) : []
  let linked = 0
  story.scenes.forEach((scene, i) => {
    const hit = files.find(f => new RegExp(`^scene-${i + 1}\.(png|jpe?g|webp)$`, 'i').test(f))
    if (hit) { scene.image = `/images/stories/${id}/${hit}`; linked++ } else delete scene.image
  })
  writeFileSync(jsonPath, JSON.stringify(story, null, 2) + '\n')
  console.log(`${id}: ${linked}/${story.scenes.length} scenes have images`)
}
