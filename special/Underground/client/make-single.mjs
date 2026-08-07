import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const dir = dirname(fileURLToPath(import.meta.url))
const distPath = join(dir, 'dist')
const outPath = join(dir, '..', 'Underground.html')

const html = readFileSync(join(distPath, 'index.html'), 'utf8')
const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/)
const jsMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)
if (!cssMatch || !jsMatch) throw new Error('could not find assets in index.html')

const css = readFileSync(join(distPath, cssMatch[1].replace(/^\//, '')), 'utf8')
const js = readFileSync(join(distPath, jsMatch[1].replace(/^\//, '')), 'utf8')

let out = html
  .replace(cssMatch[0], () => `<style>\n${css}\n</style>`)
  .replace(jsMatch[0], () => `<script type="module">\n${js}\n</script>`)

writeFileSync(outPath, out)
console.log('wrote', outPath, `(${(out.length / 1024).toFixed(1)} kB)`)
