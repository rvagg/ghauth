import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('config', () => {
  let tempDir
  let originalXdgConfigHome
  let originalAppdata
  let originalHome

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ghauth-test-'))
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME
    originalAppdata = process.env.APPDATA
    originalHome = process.env.HOME
    process.env.XDG_CONFIG_HOME = tempDir
  })

  after(async () => {
    if (originalXdgConfigHome !== undefined) {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome
    } else {
      delete process.env.XDG_CONFIG_HOME
    }
    if (originalAppdata !== undefined) {
      process.env.APPDATA = originalAppdata
    }
    if (originalHome !== undefined) {
      process.env.HOME = originalHome
    }
    await rm(tempDir, { recursive: true, force: true })
  })

  it('read returns null for missing config', async () => {
    const { createConfig } = await import('../lib/config.js')
    const config = createConfig('nonexistent-test-app')
    const data = await config.read()
    assert.equal(data, null)
  })

  it('write creates config file and read retrieves it', async () => {
    const { createConfig } = await import('../lib/config.js')
    const config = createConfig('test-write-read')
    const testData = { user: 'testuser', token: 'testtoken123' }

    await config.write(testData)
    const readData = await config.read()

    assert.deepEqual(readData, testData)
  })

  it('write creates nested directories', async () => {
    const { createConfig } = await import('../lib/config.js')
    const config = createConfig('nested-test-app')
    const testData = { foo: 'bar' }

    await config.write(testData)

    const fileContent = await readFile(config.filePath, 'utf8')
    assert.deepEqual(JSON.parse(fileContent), testData)
  })

  it('write overwrites existing config', async () => {
    const { createConfig } = await import('../lib/config.js')
    const config = createConfig('overwrite-test')

    await config.write({ old: 'data' })
    await config.write({ new: 'data' })

    const readData = await config.read()
    assert.deepEqual(readData, { new: 'data' })
  })

  it('filePath is set correctly', async () => {
    const { createConfig } = await import('../lib/config.js')
    const config = createConfig('filepath-test')

    assert.ok(config.filePath.includes('filepath-test'))
    assert.ok(config.filePath.endsWith('config.json'))
  })

  it('handles JSON parsing errors gracefully', async () => {
    const { createConfig } = await import('../lib/config.js')
    const { writeFile, mkdir } = await import('node:fs/promises')
    const { dirname } = await import('node:path')

    const config = createConfig('invalid-json-test')
    await mkdir(dirname(config.filePath), { recursive: true })
    await writeFile(config.filePath, 'not valid json{{{', 'utf8')

    await assert.rejects(
      () => config.read(),
      SyntaxError
    )
  })
})
