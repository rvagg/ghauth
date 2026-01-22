import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { newlineify, sleep, basicAuthHeader, isEnterprise, isValidPat } from '../lib/utils.js'

describe('newlineify', () => {
  it('wraps text at specified length', () => {
    const result = newlineify(20, 'hello world this is a test')
    assert.ok(result.includes('\n'))
    const lines = result.split('\n')
    for (const line of lines) {
      assert.ok(line.length <= 25, `line "${line}" exceeds limit`)
    }
  })

  it('handles empty string', () => {
    const result = newlineify(80, '')
    assert.equal(result, ' ')
  })

  it('handles single word', () => {
    const result = newlineify(80, 'hello')
    assert.equal(result.trim(), 'hello')
  })

  it('preserves words without breaking them', () => {
    const result = newlineify(5, 'hello world test')
    assert.ok(result.includes('hello'))
    assert.ok(result.includes('world'))
    assert.ok(result.includes('test'))
  })
})

describe('sleep', () => {
  it('returns a promise', () => {
    const result = sleep(0)
    assert.ok(result instanceof Promise)
  })

  it('resolves after the specified time', async () => {
    const start = Date.now()
    await sleep(0.05)
    const elapsed = Date.now() - start
    assert.ok(elapsed >= 40, `elapsed time ${elapsed}ms should be at least 40ms`)
  })
})

describe('basicAuthHeader', () => {
  it('creates valid base64 header', () => {
    const result = basicAuthHeader('user', 'pass')
    assert.equal(result, 'Basic dXNlcjpwYXNz')
  })

  it('handles special characters', () => {
    const result = basicAuthHeader('user@example.com', 'p@ss:word!')
    const decoded = Buffer.from(result.replace('Basic ', ''), 'base64').toString()
    assert.equal(decoded, 'user@example.com:p@ss:word!')
  })

  it('handles empty password', () => {
    const result = basicAuthHeader('user', '')
    const decoded = Buffer.from(result.replace('Basic ', ''), 'base64').toString()
    assert.equal(decoded, 'user:')
  })
})

describe('isEnterprise', () => {
  it('returns false for null', () => {
    assert.equal(isEnterprise(null), false)
  })

  it('returns false for undefined', () => {
    assert.equal(isEnterprise(undefined), false)
  })

  it('returns false for github.com URLs', () => {
    assert.equal(isEnterprise('https://github.com/login'), false)
  })

  it('returns false for api.github.com URLs', () => {
    assert.equal(isEnterprise('https://api.github.com/authorizations'), false)
  })

  it('returns true for enterprise URLs', () => {
    assert.equal(isEnterprise('https://github.mycompany.com/api/v3'), true)
  })

  it('returns true for custom domain enterprise URLs', () => {
    assert.equal(isEnterprise('https://enterprise.example.org/api/v3/authorizations'), true)
  })
})

describe('isValidPat', () => {
  it('returns false for null', () => {
    assert.equal(isValidPat(null), false)
  })

  it('returns false for undefined', () => {
    assert.equal(isValidPat(undefined), false)
  })

  it('returns false for empty string', () => {
    assert.equal(isValidPat(''), false)
  })

  it('returns false for invalid format', () => {
    assert.equal(isValidPat('invalid-token'), false)
    assert.equal(isValidPat('tooshort'), false)
  })

  it('accepts classic PAT (40 hex chars)', () => {
    assert.equal(isValidPat('a'.repeat(40)), true)
    assert.equal(isValidPat('1234567890abcdef1234567890abcdef12345678'), true)
  })

  it('accepts classic PAT with ghp_ prefix', () => {
    assert.equal(isValidPat('ghp_' + 'a'.repeat(36)), true)
    assert.equal(isValidPat('ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'), true)
  })

  it('accepts fine-grained PAT with github_pat_ prefix', () => {
    const fineGrained = 'github_pat_' + 'a'.repeat(22) + '_' + 'b'.repeat(59)
    assert.equal(isValidPat(fineGrained), true)
  })

  it('rejects ghp_ with wrong length', () => {
    assert.equal(isValidPat('ghp_tooshort'), false)
  })

  it('rejects github_pat_ with wrong format', () => {
    assert.equal(isValidPat('github_pat_tooshort'), false)
  })
})
