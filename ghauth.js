import { read } from 'read'
import ora from 'ora'
import { createConfig } from './lib/config.js'
import { newlineify, sleep, basicAuthHeader, isEnterprise, isValidPat } from './lib/utils.js'

const defaultUA = 'Magic Node.js application that does magic things with ghauth'
const defaultScopes = []
const defaultPasswordReplaceChar = '\u2714'

const defaultDeps = { read, ora, createConfig, fetch: globalThis.fetch }

/**
 * Prompt the user for credentials via OAuth device flow.
 * @param {object} options - Auth options
 * @param {object} deps - Injected dependencies
 * @returns {Promise<object>} Token data
 */
async function deviceFlowPrompt (options, deps) {
  const { read, ora, fetch } = deps
  const scopes = options.scopes || defaultScopes
  const passwordReplaceChar = options.passwordReplaceChar || defaultPasswordReplaceChar
  const deviceCodeUrl = 'https://github.com/login/device/code'
  const fallbackDeviceAuthUrl = 'https://github.com/login/device'
  const accessTokenUrl = 'https://github.com/login/oauth/access_token'
  const oauthAppsBaseUrl = 'https://github.com/settings/connections/applications'
  const userEndpointUrl = 'https://api.github.com/user'
  const patUrl = 'https://github.com/settings/tokens'

  const defaultReqOptions = {
    headers: {
      'User-Agent': options.userAgent || defaultUA,
      Accept: 'application/json'
    },
    method: 'post'
  }

  const deviceFlowSpinner = ora()
  let endDeviceFlow = false
  let interruptHandlerRef
  let tokenData

  if (!options.noDeviceFlow) {
    tokenData = await Promise.race([deviceFlow(), deviceFlowInterrupt()])
    process.stdin.off('keypress', interruptHandlerRef)

    if (tokenData === false) {
      deviceFlowSpinner.warn('Device flow canceled.')
      tokenData = await patFlow()
    }
  } else {
    console.log('Personal access token auth for Github.')
    tokenData = await patFlow()
  }

  return tokenData

  async function patFlow () {
    console.log(`
  Create a Personal Access Token at ${patUrl}

    1. Click "Generate new token" → "Generate new token (classic)"
       (fine-grained tokens also work)
    2. Set a name, e.g. "${options.configName || 'my-cli-app'}"
    3. ${scopes.length ? `Select scopes: ${scopes.join(', ')}` : 'No scopes needed'}
    4. Generate and copy the token
`)

    const pat = await read({ prompt: 'Paste your token here: ', silent: true, replace: passwordReplaceChar })
    if (!pat) throw new TypeError('Empty personal access token received.')
    if (!isValidPat(pat)) throw new TypeError('Invalid personal access token format')
    const tokenData = { token: pat }

    return supplementUserData(tokenData)
  }

  function deviceFlowInterrupt () {
    return new Promise((resolve, reject) => {
      process.stdin.on('keypress', keyPressHandler)

      interruptHandlerRef = keyPressHandler
      function keyPressHandler (letter, key) {
        if (key.name === 'return') {
          endDeviceFlow = true
          resolve(false)
        }
      }
    })
  }

  async function deviceFlow () {
    let currentInterval
    let currentDeviceCode
    let currentUserCode
    let verificationUri

    await initializeNewDeviceFlow()

    const authPrompt = '  Authorize with Github by opening this URL in a browser:' +
                       '\n' +
                       '\n' +
                       `    ${verificationUri}` +
                       '\n' +
                       '\n' +
                       '  and enter the following User Code:\n' +
                       '  (or press \u23ce to enter a personal access token)\n'

    console.log(authPrompt)

    deviceFlowSpinner.start(`User Code: ${currentUserCode}`)

    const accessToken = await pollAccessToken()
    if (accessToken === false) return false

    const tokenData = { token: accessToken.access_token, scope: accessToken.scope }
    deviceFlowSpinner.succeed(`Device flow complete.  Manage at ${oauthAppsBaseUrl}/${options.clientId}`)

    return supplementUserData(tokenData)

    async function initializeNewDeviceFlow () {
      const deviceCode = await requestDeviceCode()

      if (deviceCode.error) {
        let error
        switch (deviceCode.error) {
          case 'Not Found': {
            error = new Error('Not found: is the clientId correct?')
            break
          }
          case 'unauthorized_client': {
            error = new Error(`${deviceCode.error_description} Did you enable 'Device authorization flow' for your oAuth application?`)
            break
          }
          default: {
            error = new Error(deviceCode.error_description || deviceCode.error)
            break
          }
        }
        error.data = deviceCode
        throw error
      }

      if (!(deviceCode.device_code || deviceCode.user_code)) {
        const error = new Error('No device code from GitHub!')
        error.data = deviceCode
        throw error
      }

      currentInterval = deviceCode.interval || 5
      verificationUri = deviceCode.verification_uri || fallbackDeviceAuthUrl
      currentDeviceCode = deviceCode.device_code
      currentUserCode = deviceCode.user_code
    }

    async function pollAccessToken () {
      let endDeviceFlowDetected

      while (!endDeviceFlowDetected) {
        await sleep(currentInterval)
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
        endDeviceFlowDetected = endDeviceFlow
      }

      return false
    }
  }

  function requestAccessToken (deviceCode) {
    const query = {
      client_id: options.clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    }

    return fetch(`${accessTokenUrl}?${new URLSearchParams(query).toString()}`, defaultReqOptions).then(req => req.json())
  }

  function requestDeviceCode () {
    const query = {
      client_id: options.clientId
    }
    if (scopes.length) query.scope = scopes.join(' ')

    return fetch(`${deviceCodeUrl}?${new URLSearchParams(query).toString()}`, defaultReqOptions).then(req => req.json())
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

    return fetch(userEndpointUrl, reqOptions).then(req => req.json())
  }

  async function supplementUserData (tokenData) {
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

/**
 * Prompt the user for credentials via GitHub Enterprise basic auth.
 * @param {object} options - Auth options
 * @param {object} deps - Injected dependencies
 * @returns {Promise<object>} Token data
 */
async function enterprisePrompt (options, deps) {
  const { read, fetch } = deps
  const defaultNote = 'Node.js command-line app with ghauth'
  const promptName = options.promptName || 'Github Enterprise'
  const accessTokenUrl = options.accessTokenUrl
  const scopes = options.scopes || defaultScopes
  const usernamePrompt = options.usernamePrompt || `Your ${promptName} username:`
  const tokenQuestionPrompt = options.tokenQuestionPrompt || 'This appears to be a personal access token, is that correct? [y/n] '
  const passwordReplaceChar = options.passwordReplaceChar || defaultPasswordReplaceChar
  const authUrl = options.authUrl || 'https://api.github.com/authorizations'
  let passwordPrompt = options.passwordPrompt

  if (!passwordPrompt) {
    let patMsg = `You may either enter your ${promptName} password or use a personal access token generated at ${accessTokenUrl} ` +
      (scopes.length ? `with the following scopes: ${scopes.join(', ')}` : '(no scopes necessary)')
    patMsg = newlineify(80, patMsg)
    passwordPrompt = `${patMsg}\nYour ${promptName} password:`
  }

  const user = await read({ prompt: usernamePrompt })
  if (user === '') {
    return
  }

  const pass = await read({ prompt: passwordPrompt, silent: true, replace: passwordReplaceChar })

  if (pass.length === 40) {
    do {
      const yorn = await read({ prompt: tokenQuestionPrompt })

      if (yorn.toLowerCase() === 'y') {
        return { user, token: pass }
      }

      if (yorn.toLowerCase() === 'n') {
        break
      }
    } while (true)
  }

  const otpReqOptions = {
    headers: {
      'User-Agent': options.userAgent || defaultUA,
      Authorization: basicAuthHeader(user, pass)
    },
    method: 'POST'
  }

  const response = await fetch(authUrl, otpReqOptions)
  const otpHeader = response.headers.get('x-github-otp')
  response.arrayBuffer()

  let otp
  if (otpHeader && otpHeader.indexOf('required') > -1) {
    otp = await read({ prompt: 'Your GitHub OTP/2FA Code (required):' })
  }

  const currentDate = new Date().toJSON()
  const patReqOptions = {
    headers: {
      'User-Agent': options.userAgent || defaultUA,
      'Content-type': 'application/json',
      Authorization: basicAuthHeader(user, pass)
    },
    method: 'POST',
    body: JSON.stringify({
      scopes,
      note: `${(options.note || defaultNote)} (${currentDate})`
    })
  }
  if (otp) patReqOptions.headers['X-GitHub-OTP'] = otp

  const data = await fetch(authUrl, patReqOptions).then(res => res.json())

  if (data.message) {
    const error = new Error(data.message)
    error.data = data
    throw error
  }

  if (!data.token) {
    throw new Error('No token from GitHub!')
  }

  return { user, token: data.token, scope: scopes.join(' ') }
}

/**
 * Main auth function.
 * @param {object} options - Auth options
 * @param {object} deps - Injected dependencies
 * @returns {Promise<object>} Auth data
 */
async function auth (options, deps) {
  const { createConfig } = deps

  if (typeof options !== 'object' || options === null) {
    throw new TypeError('ghauth requires an options argument')
  }

  let config

  if (!options.noSave) {
    if (typeof options.configName !== 'string') {
      throw new TypeError('ghauth requires an options.configName property')
    }

    config = createConfig(options.configName)
    const authData = await config.read()
    if (authData && authData.user && authData.token) {
      return authData
    }
  }

  let tokenData
  if (!isEnterprise(options.authUrl)) {
    // Use PAT flow if no clientId provided, or if noDeviceFlow is explicitly set
    const usePatFlow = typeof options.clientId !== 'string' || options.noDeviceFlow
    tokenData = await deviceFlowPrompt({ ...options, noDeviceFlow: usePatFlow }, deps)
  } else {
    tokenData = await enterprisePrompt(options, deps)
  }
  if (!tokenData || !tokenData.token || !tokenData.user) throw new Error('Authentication error: token or user not generated')

  if (options.noSave) {
    return tokenData
  }

  process.umask(0o077)
  await config.write(tokenData)

  process.stdout.write(`Wrote access token to "${config.filePath}"\n`)

  return tokenData
}

/**
 * Create and load persistent GitHub authentication tokens for command-line apps.
 * @param {object} options - Auth options
 * @param {object} [deps] - Optional dependency injection for testing
 * @returns {Promise<object>} Auth data with user and token
 */
export default function ghauth (options, deps) {
  return auth(options, deps ? { ...defaultDeps, ...deps } : defaultDeps)
}
