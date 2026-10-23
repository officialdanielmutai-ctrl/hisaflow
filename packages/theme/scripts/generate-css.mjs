/* eslint-disable */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { generateThemeCss } = require('../dist/index.js')

const here = dirname(fileURLToPath(import.meta.url))
const target = join(
  here,
  '..',
  '..',
  '..',
  'apps',
  'frontend',
  'app',
  'theme-tokens.generated.css'
)

writeFileSync(target, generateThemeCss(), 'utf8')
console.log(`Wrote ${target}`)
