#!/usr/bin/env node

/**
 * Smoke test for ghauth ESM migration.
 * Run with: node test/smoke.js
 *
 * This test prompts you for a PAT to verify the full auth flow works.
 */

import ghauth from '../ghauth.js'

console.log('ghauth ESM smoke test\n')

try {
  const authData = await ghauth({
    configName: 'ghauth-smoke-test',
    scopes: ['read:user'],
    noSave: true
  })

  console.log('\nSmoke test PASSED!')
  console.log('Authenticated as:', authData.user)
} catch (err) {
  console.error('\nSmoke test FAILED:', err.message)
  process.exit(1)
}
