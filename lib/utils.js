/**
 * Split a string at roughly `len` characters, being careful of word boundaries.
 * @param {number} len - The target line length
 * @param {string} str - The string to wrap
 * @returns {string} The wrapped string
 */
export function newlineify (len, str) {
  let s = ''
  let l = 0
  const sa = str.split(' ')

  while (sa.length) {
    if (l + sa[0].length > len) {
      s += '\n'
      l = 0
    } else {
      s += ' '
    }
    s += sa[0]
    l += sa[0].length
    sa.splice(0, 1)
  }

  return s
}

/**
 * Sleep for a given number of seconds.
 * @param {number} s - Seconds to sleep
 * @returns {Promise<void>}
 */
export function sleep (s) {
  const ms = s * 1000
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a Basic auth header value.
 * @param {string} user - Username
 * @param {string} pass - Password
 * @returns {string} The Basic auth header value
 */
export function basicAuthHeader (user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

/**
 * Check if the auth URL is for a GitHub Enterprise instance.
 * @param {string|null|undefined} authUrl - The auth URL
 * @returns {boolean} True if enterprise, false otherwise
 */
export function isEnterprise (authUrl) {
  if (!authUrl) return false
  const parsedAuthUrl = new URL(authUrl)
  if (parsedAuthUrl.host === 'github.com') return false
  if (parsedAuthUrl.host === 'api.github.com') return false
  return true
}

/**
 * Validate a GitHub personal access token format.
 * Supports classic PATs (40 hex chars or ghp_ prefix) and fine-grained PATs (github_pat_ prefix).
 * @param {string} token - The token to validate
 * @returns {boolean} True if valid format, false otherwise
 */
export function isValidPat (token) {
  if (!token || typeof token !== 'string') return false
  // Classic PAT (old format): 40 hex characters
  if (/^[0-9a-f]{40}$/i.test(token)) return true
  // Classic PAT (new format): ghp_ prefix + 36-251 alphanumeric chars
  if (/^ghp_[A-Za-z0-9]{36,251}$/.test(token)) return true
  // Fine-grained PAT: github_pat_ prefix, ~93 chars total
  if (/^github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}$/.test(token)) return true
  return false
}
