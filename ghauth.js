'use strict'

const { promisify } = require('util')
const read = promisify(require('read'))
const fetch = require('node-fetch')
const appCfg = require('application-config')
const querystring = require('querystring')
const ora = require('ora')

const defaultUA = 'Magic Node.js application that does magic things with ghauth'
const defaultScopes = []
const defaultDeviceCodeUrl = 'https://github.com/login/device/code'
const defaultDeviceAuthUrl = 'https://github.com/login/device'
const defaultAccessTokenUrl = 'https://github.com/login/oauth/access_token'
const defaultOauthAppsBaseUrl = 'https://github.com/settings/connections/applications'
const defaultUserEndpoint = 'https://api.github.com/user'
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

// prompt the user for credentials
async function prompt (options) {
  const promptName = options.promptName || defaultPromptName
  const deviceCodeUrl = options.deviceCodeUrl || defaultDeviceCodeUrl
  const accessTokenUrl = options.accessTokenUrl || defaultAccessTokenUrl
  const oauthAppsBaseUrl = options.oauthAppsBaseUrl || defaultOauthAppsBaseUrl
  const scopes = options.scopes || defaultScopes
  const passwordReplaceChar = options.passwordReplaceChar || defaultPasswordReplaceChar
  const deviceFlowSpinner = ora()

  const defaultReqOptions = {
    headers: {
      'User-Agent': options.userAgent || defaultUA,
      Accept: 'application/json'
    },
    method: 'post'
  }

  // get token data from device flow, or interrupt to try PAT flow
  let endDeviceFlow = false // race status indicator for deviceFlowInterrupt and deviceFlow
  let interruptHandlerRef // listener reference for deviceFlowInterrupt
  let tokenData = await Promise.race([deviceFlow(), deviceFlowInterrupt()])
  process.stdin.off('keypress', interruptHandlerRef) // disable keypress listener when race finishes

  // try the PAT flow if interrupted
  if (tokenData === false) tokenData = await patFlow()

  if (!(tokenData || tokenData.token || tokenData.user)) throw new Error('Authentication failed.')
  return tokenData

  // prompt for a personal access token with simple validation
  async function patFlow () {
    let patMsg = `Enter a 40 character personal access token generated at ${defaultPatUrl} ` +
      (scopes.length ? `with the following scopes: ${scopes.join(', ')}` : '(no scopes necessary)') + '\n' +
      'PAT: '
    patMsg = newlineify(80, patMsg)
    const pat = await read({ prompt: patMsg, silent: true, replace: passwordReplaceChar })
    if (!pat) throw new TypeError('Empty personal access token received.')
    if (pat.length !== 40) throw new TypeError('Personal access tokens must be 40 characters long')
    const tokenData = { token: pat }

    return supplementUserData(tokenData)
  }

  // cancel deviceFlow if user presses enter``
  function deviceFlowInterrupt () {
    return new Promise((resolve, reject) => {
      process.stdin.on('keypress', keyPressHandler)

      interruptHandlerRef = keyPressHandler
      function keyPressHandler (letter, key) {
        if (key.name === 'return') {
          endDeviceFlow = true
          deviceFlowSpinner.warn('Device flow canceled.')
          resolve(false)
        }
      }
    })
  }

  // create a device flow session and return tokenData
  async function deviceFlow () {
    let currentInterval
    let currentDeviceCode
    let currentUserCode
    let verificationUri

    await initializeNewDeviceFlow()

    const authPrompt = `  Authorize with ${promptName} by opening this URL in a browser:` +
                       '\n' +
                       '\n' +
                       `    ${verificationUri}` +
                       '\n' +
                       '\n' +
                       '  and enter the following User Code:\n' +
                       '  (or press ⏎ to enter a personal access token)\n'

    console.log(authPrompt)

    deviceFlowSpinner.start(`User Code: ${currentUserCode}`)

    const accessToken = await pollAccessToken()
    if (accessToken === false) return false // interrupted, don't return anything

    const tokenData = { token: accessToken.access_token, scope: accessToken.scope }
    deviceFlowSpinner.succeed(`Device flow complete.  Manage at ${oauthAppsBaseUrl}/${options.clientId}`)

    return supplementUserData(tokenData)

    async function initializeNewDeviceFlow () {
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

      currentInterval = deviceCode.interval || 5
      verificationUri = deviceCode.verification_uri || defaultDeviceAuthUrl
      currentDeviceCode = deviceCode.device_code
      currentUserCode = deviceCode.user_code
    }

    async function pollAccessToken () {
      let endDeviceFlowDetected

      while (!endDeviceFlowDetected) {
        endDeviceFlowDetected = endDeviceFlow // update inner interrupt scope
        await delay(currentInterval)
        const data = await requestAccessToken(currentDeviceCode)

        if (data.access_token) return data
        if (data.error === 'authorization_pending') continue
        if (data.error === 'slow_down') currentInterval = data.interval
        if (data.error === 'expired_token') {
          deviceFlowSpinner.text('User Code: Updating...')
          await initializeNewDeviceFlow()
          deviceFlowSpinner.text(`User Code: ${currentUserCode}`)
        }
        if (data.error === 'unsupported_grant_type') throw new Error(data.error_description || 'Incorrect grant type.')
        if (data.error === 'incorrect_client_credentials') throw new Error(data.error_description || 'Incorrect clientId.')
        if (data.error === 'incorrect_device_code') throw new Error(data.error_description || 'Incorrect device code.')
        if (data.error === 'access_denied') throw new Error(data.error_description || 'The authorized user canceled the access request.')
      }

      // interrupted
      return false
    }
  }

  function requestAccessToken (deviceCode) {
    const query = {
      client_id: options.clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    }

    return fetch(`${accessTokenUrl}?${querystring.stringify(query)}`, defaultReqOptions).then(req => req.json())
  }

  function requestDeviceCode () {
    const query = {
      client_id: options.clientId
    }
    if (scopes.length) query.scope = scopes.join(' ')

    return fetch(`${deviceCodeUrl}?${querystring.stringify(query)}`, defaultReqOptions).then(req => req.json())
  }

  function requestUser (token) {
    const reqOptions = {
      headers: {
        'User-Agent': options.userAgent || defaultUA,
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`
      },
      method: 'get'
    }

    return fetch(defaultUserEndpoint, reqOptions).then(req => req.json())
  }

  async function supplementUserData (tokenData) {
    // Get user login info
    const userSpinner = ora().start('Retrieving user...')
    try {
      const user = await requestUser(tokenData.token)
      if (!user || !user.login) {
        userSpinner.fail('Failed to retrieve user info.')
      } else {
        userSpinner.succeed(`Authorized for ${user.login}`)
      }
      tokenData.user = user.login
    } catch (e) {
      userSpinner.fail(`Failed to retrieve user info: ${e.message}`)
    }

    return tokenData
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
