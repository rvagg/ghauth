import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ghauth from '../ghauth.js'

function createMockDeps (overrides = {}) {
  return {
    createConfig: (name) => ({
      filePath: `/fake/path/${name}/config.json`,
      read: async () => null,
      write: async () => {}
    }),
    ora: () => ({
      start: function () { return this },
      succeed: function () { return this },
      fail: function () { return this },
      warn: function () { return this },
      text: function () { return this }
    }),
    read: async () => '',
    fetch: async () => ({
      json: async () => ({}),
      headers: { get: () => null },
      arrayBuffer: async () => ({})
    }),
    ...overrides
  }
}

describe('ghauth', () => {
  it('throws if options is not an object', async () => {
    await assert.rejects(
      () => ghauth(null, createMockDeps()),
      {
        name: 'TypeError',
        message: 'ghauth requires an options argument'
      }
    )
  })

  it('throws if options is a string', async () => {
    await assert.rejects(
      () => ghauth('invalid', createMockDeps()),
      {
        name: 'TypeError',
        message: 'ghauth requires an options argument'
      }
    )
  })

  it('throws if configName is missing when noSave is false', async () => {
    await assert.rejects(
      () => ghauth({ clientId: 'test' }, createMockDeps()),
      {
        name: 'TypeError',
        message: 'ghauth requires an options.configName property'
      }
    )
  })

  it('defaults to PAT flow when clientId is not provided', async () => {
    let patFlowUsed = false
    const mockDeps = createMockDeps({
      read: async (opts) => {
        if (opts.prompt.includes('token')) {
          patFlowUsed = true
          return 'a'.repeat(40)
        }
        return ''
      },
      fetch: async () => ({
        json: async () => ({ login: 'testuser' }),
        headers: { get: () => null },
        arrayBuffer: async () => ({})
      })
    })

    await ghauth({ configName: 'test' }, mockDeps)
    assert.equal(patFlowUsed, true, 'should use PAT flow when clientId is missing')
  })

  it('returns cached token if available', async () => {
    const cachedData = { user: 'cacheduser', token: 'cachedtoken123' }
    const mockDeps = createMockDeps({
      createConfig: () => ({
        filePath: '/fake/path/config.json',
        read: async () => cachedData,
        write: async () => {}
      })
    })

    const result = await ghauth({ configName: 'test', clientId: 'x' }, mockDeps)
    assert.deepEqual(result, cachedData)
  })

  it('returns cached token even without clientId if token exists', async () => {
    const cachedData = { user: 'existinguser', token: 'existingtoken' }
    const mockDeps = createMockDeps({
      createConfig: () => ({
        filePath: '/fake/path/config.json',
        read: async () => cachedData,
        write: async () => {}
      })
    })

    const result = await ghauth({ configName: 'test' }, mockDeps)
    assert.deepEqual(result, cachedData)
  })

  it('does not require configName when noSave is true', async () => {
    const mockDeps = createMockDeps({
      createConfig: () => {
        throw new Error('createConfig should not be called')
      }
    })

    await assert.rejects(
      () => ghauth({ noSave: true, clientId: 'test', noDeviceFlow: true }, mockDeps),
      { name: 'TypeError' }
    )
  })

  it('skips config read when noSave is true', async () => {
    let configReadCalled = false
    const mockDeps = createMockDeps({
      createConfig: () => ({
        filePath: '/fake/path/config.json',
        read: async () => {
          configReadCalled = true
          return { user: 'test', token: 'test' }
        },
        write: async () => {}
      }),
      read: async () => 'a'.repeat(40),
      fetch: async () => ({
        json: async () => ({ login: 'testuser' }),
        headers: { get: () => null },
        arrayBuffer: async () => ({})
      })
    })

    await ghauth({ noSave: true, clientId: 'test', noDeviceFlow: true }, mockDeps)
    assert.equal(configReadCalled, false, 'config.read should not be called when noSave is true')
  })

  describe('noDeviceFlow mode', () => {
    it('prompts for PAT when noDeviceFlow is true', async () => {
      let readPromptCalled = false
      const mockDeps = createMockDeps({
        read: async (opts) => {
          readPromptCalled = true
          if (opts.prompt.includes('token')) {
            return 'a'.repeat(40)
          }
          return ''
        },
        fetch: async () => ({
          json: async () => ({ login: 'testuser' }),
          headers: { get: () => null },
          arrayBuffer: async () => ({})
        })
      })

      const result = await ghauth({
        configName: 'test',
        noDeviceFlow: true
      }, mockDeps)

      assert.equal(readPromptCalled, true)
      assert.equal(result.token, 'a'.repeat(40))
    })

    it('throws on empty PAT', async () => {
      const mockDeps = createMockDeps({
        read: async () => ''
      })

      await assert.rejects(
        () => ghauth({ configName: 'test', noDeviceFlow: true }, mockDeps),
        {
          name: 'TypeError',
          message: 'Empty personal access token received.'
        }
      )
    })

    it('throws on invalid PAT format', async () => {
      const mockDeps = createMockDeps({
        read: async () => 'invalid-token-format'
      })

      await assert.rejects(
        () => ghauth({ configName: 'test', noDeviceFlow: true }, mockDeps),
        {
          name: 'TypeError',
          message: 'Invalid personal access token format'
        }
      )
    })
  })

  describe('enterprise mode', () => {
    it('uses enterprise prompt for enterprise URLs', async () => {
      let usernamePromptSeen = false
      const mockDeps = createMockDeps({
        read: async (opts) => {
          if (opts.prompt.includes('username')) {
            usernamePromptSeen = true
            return ''
          }
          return ''
        }
      })

      await assert.rejects(
        () => ghauth({
          configName: 'test',
          authUrl: 'https://enterprise.example.com/api/v3/authorizations'
        }, mockDeps),
        {
          message: 'Authentication error: token or user not generated'
        }
      )

      assert.equal(usernamePromptSeen, true)
    })
  })
})
