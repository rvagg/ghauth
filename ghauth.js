'use strict'

const { promisify } = require('util')
const read = promisify(require('read'))
const hyperquest = require('hyperquest')
const bl = require('bl')
const appCfg = require('application-config')
const querystring = require('querystring')
const ora = require('ora')
const logSymbols = require('log-symbols')
const { Octokit } = require('@octokit/rest')

const defaultUA = 'Magic Node.js application that does magic things with ghauth'
const defaultScopes = []
const defaultDeviceCodeUrl = 'https://github.com/login/device/code'
const defaultDeviceAuthUrl = 'https://github.com/login/device'
const defaultAccessTokenUrl = 'https://github.com/login/oauth/access_token'
const defaultOauthAppsBaseUrl = 'https://github.com/settings/connections/applications/'
const defaultPatUrl = 'https://github.com/settings/tokens'
const defaultPromptName = 'GitHub'
const defaultPasswordReplaceChar = '\u2714'

// split a string at roughly `len` characters, being careful of word boundaries
function newlineify (len, str) {
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

function delay (s) {
  const ms = s * 1000
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function hyperquestJson (url, query, reqOptions) {
  const jsonData = await new Promise((resolve, reject) => {
    const req = hyperquest(`${url}?${querystring.stringify(query)}`, reqOptions)
    req.pipe(bl((err, data) => {
      if (err) {
        return reject(err)
      }
      resolve(data)
    }))
    req.end()
  })

  return JSON.parse(jsonData.toString())
}

// prompt the user for credentials
async function prompt (options) {
  const promptName = options.promptName || defaultPromptName
  const deviceCodeUrl = options.deviceCodeUrl || defaultDeviceCodeUrl
  const accessTokenUrl = options.accessTokenUrl || defaultAccessTokenUrl
  const scopes = options.scopes || defaultScopes
  const passwordReplaceChar = options.passwordReplaceChar || defaultPasswordReplaceChar
  const spinner = ora()

  let endDeviceFlow = false

  const defaultReqOptions = {
    headers: {
      'User-Agent': options.userAgent || defaultUA,
      Accept: 'application/json'
    },
    method: 'post'
  }

  // get token data from device flow, or interrupt for patFlow
  let tokenData = await Promise.race([deviceCodeFlow(), patFlowIterrupt()])
  if (tokenData === false) tokenData = await patFlow()
  return tokenData

  async function patFlow () {
    let patMsg = `Enter a 40 character personal access token generated at ${defaultPatUrl} ` +
      (scopes.length ? `with the following scopes: ${scopes.join(', ')}` : '(no scopes necessary)') + '\n' +
      'PAT: '
    patMsg = newlineify(80, patMsg)
    const pat = await read({ prompt: patMsg, silent: true, replace: passwordReplaceChar })
    const tokenData = { token: pat }
    // Add user login info
    try {
      const octokit = new Octokit({ auth: pat })
      const user = await octokit.request('/user')
      tokenData.user = user.data.login
    } catch (e) { /* oh well */ }

    return tokenData
  }

  // cancel deviceFlow if user presses enter``
  function patFlowIterrupt () {
    const p = new Promise((resolve, reject) => {
      process.stdin.on('keypress', keyPressHandler)

      function keyPressHandler (letter, key) {
        // clean up event listeners if deviceFlow is over, and user presses another key
        if (endDeviceFlow) return process.stdin.off('keypress', keyPressHandler)
        if (key.name === 'return') {
          endDeviceFlow = true
          spinner.stopAndPersist({ symbol: logSymbols.error, text: 'Device flow canceled' })
          resolve(false)
        }
      }
    })
    return p
  }

  async function deviceCodeFlow () {
    const deviceCode = await requestDeviceCode()

    if (deviceCode.error) {
      const error = new Error(deviceCode.error_description)
      error.data = deviceCode
      throw error
    }

    if (!(deviceCode.device_code || deviceCode.user_code)) {
      const error = new Error('No device code from GitHub!')
      error.data = deviceCode
      throw error
    }

    const authPrompt = `  Authorize with ${promptName} by opening this URL in a browser:` +
                       '\n' +
                       '\n' +
                       `    ${deviceCode.verification_uri || defaultDeviceAuthUrl}` +
                       '\n' +
                       '\n' +
                       '  and enter the following User Code:\n' +
                       '  (or press ⏎ to enter a personal access token)\n'

    console.log(authPrompt)

    spinner.start(`User Code: ${deviceCode.user_code}`)

    const accessToken = await pollAccessToken(deviceCode)
    if (accessToken === false) return false // interrupted, don't return anything

    const tokenData = { token: accessToken.access_token, scope: accessToken.scope }

    // Add user login info
    try {
      const octokit = new Octokit({ auth: accessToken.access_token })
      const user = await octokit.request('/user')
      tokenData.user = user.data.login
    } catch (e) { /* oh well */ }

    spinner.stopAndPersist({ symbol: logSymbols.success })

    return tokenData
  }

  async function pollAccessToken ({ device_code, user_code, verification_uri, expires_in, interval = 5 }) { /* eslint-disable-line camelcase */
    let currentInterval = interval
    let endDeviceFlowDetected = endDeviceFlow

    while (!endDeviceFlowDetected) {
      endDeviceFlowDetected = endDeviceFlow // update inner interrupt scope
      await delay(currentInterval)
      const data = await requestAccessToken(device_code)

      if (data.access_token) return data
      if (data.error === 'authorization_pending') continue
      if (data.error === 'slow_down') currentInterval = data.interval
      if (data.error === 'expired_token') {
        // TODO: get a new device code and update the prompt
        throw new Error(data.error_description || 'Device token expired, please try again.')
      }
      if (data.error === 'unsupported_grant_type') throw new Error(data.error_description || 'Incorrect grant type.')
      if (data.error === 'incorrect_client_credentials') throw new Error(data.error_description || 'Incorrect clientId.')
      if (data.error === 'incorrect_device_code') throw new Error(data.error_description || 'Incorrect device code.')
      if (data.error === 'access_denied') throw new Error(data.error_description || 'The authorized user canceled the access request.')
    }

    // interrupted
    return false
  }

  function requestAccessToken (deviceCode) {
    const query = {
      client_id: options.clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    }

    return hyperquestJson(accessTokenUrl, query, defaultReqOptions)
  }

  function requestDeviceCode () {
    const query = {
      client_id: options.clientId
    }
    if (scopes.length) query.scope = scopes.join(' ')

    return hyperquestJson(deviceCodeUrl, query, defaultReqOptions)
  }
}

async function auth (options) {
  if (typeof options !== 'object') {
    throw new TypeError('ghauth requires an options argument')
  }

  let config

  if (!options.noSave) {
    if (typeof options.configName !== 'string') {
      throw new TypeError('ghauth requires an options.configName property')
    }

    config = appCfg(options.configName)
    const authData = await config.read()
    if (authData && authData.user && authData.token) {
      // we had it saved in a config file
      return authData
    }
  }

  if (typeof options.clientId !== 'string') {
    throw new TypeError('ghauth requires an options.clientId property')
  }

  const tokenData = await prompt(options) // prompt the user for data

  if (options.noSave) {
    return tokenData
  }

  process.umask(0o077)
  await config.write(tokenData)

  process.stdout.write(`Wrote access token to "${config.filePath}"\n`)

  return tokenData
}

module.exports = function ghauth (options, callback) {
  if (typeof callback !== 'function') {
    return auth(options) // promise, it can be awaited
  }

  auth(options).then((data) => callback(null, data)).catch(callback)
}
