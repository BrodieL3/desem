import {syncDefenseMoneyMacroContextFromFile} from '../lib/data/signals/sync'

function parseArgs(argv: string[]) {
  for (const arg of argv) {
    if (arg === '--help') {
      console.log(`\nSync curated macro context YAML into defense_money_macro_context.\n\nUsage:\n  bun run scripts/sync-macro-context.ts\n\nFlags:\n  --help    Show this help\n`)
      process.exit(0)
    }
  }
}

async function run() {
  parseArgs(process.argv.slice(2))
  const result = await syncDefenseMoneyMacroContextFromFile()
  console.log(`Macro context sync complete.`)
  console.log(`Path: ${result.path}`)
  console.log(`Rows upserted: ${result.count}`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
