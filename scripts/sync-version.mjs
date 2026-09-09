/**
 * sync-version.mjs
 *
 * ルートの package.json の version を
 * packages/functions/src/types/shared.ts の VERSION 定数に同期するスクリプト。
 *
 * 使い方: node scripts/sync-version.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ルート package.json からバージョンを取得
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
const version = pkg.version

// shared.ts のパス
const sharedPath = resolve(root, 'packages/functions/src/types/shared.ts')
const content = readFileSync(sharedPath, 'utf-8')

// VERSION 定数を置換
const updated = content.replace(
  /export const VERSION = '.*'/,
  `export const VERSION = '${version}'`,
)

if (content !== updated) {
  writeFileSync(sharedPath, updated, 'utf-8')
  console.log(`✅ VERSION を '${version}' に同期しました (shared.ts)`)
} else {
  console.log(`✅ VERSION は既に '${version}' です (shared.ts)`)
}

// openapi.yaml のパス
const openApiPath = resolve(root, 'docs/openapi.yaml')
try {
  const openApiContent = readFileSync(openApiPath, 'utf-8')
  const openApiUpdated = openApiContent.replace(
    /(info:\r?\n\s+title:.*\r?\n\s+version:)\s*.*/,
    `$1 ${version}`,
  )
  if (openApiContent !== openApiUpdated) {
    writeFileSync(openApiPath, openApiUpdated, 'utf-8')
    console.log(`✅ OpenAPI バージョンを '${version}' に同期しました (openapi.yaml)`)
  } else {
    console.log(`✅ OpenAPI バージョンは既に '${version}' です (openapi.yaml)`)
  }
} catch {
  // openapi.yaml が存在しない場合はスキップ
}
