'use strict'

const { promisify } = require('util')
const read = promisify(require('read'))
const hyperquest = require('hyperquest')
const bl = require('bl')
const appCfg = require('application-config')

const defaultUA = 'Magic Node.js application that does magic things with ghauth'
const defaultScopes = []
const defaultNote = 'Node.js command-line app with ghauth'
const defaultAuthUrl = 'https://api.github.com/authorizations'
const defaultPromptName = 'GitHub'
const defaultAccessTokenUrl = 'https://github.com/settings/tokens'
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

async function createAuth (options) {
  const reqOptions = {
    headers: {
      'X-GitHub-OTP': options.otp || null,
      'User-Agent': options.userAgent || defaultUA,
      'Content-type': 'application/json'
    },
    method: 'post',
    auth: `${options.user}:${options.pass}`
  }
  const authUrl = options.authUrl || defaultAuthUrl
  const currentDate = new Date().toJSON()

  const jsonData = await new Promise((resolve, reject) => {
    const req = hyperquest(authUrl, reqOptions)

    req.pipe(bl((err, data) => {
      if (err) {
        return reject(err)
      }
      resolve(data)
    }))

    req.end(JSON.stringify({
      scopes: options.scopes || defaultScopes,
      note: `${(options.note || defaultNote)} (${currentDate})`
    }))
  })

  const data = JSON.parse(jsonData.toString())

  if (data.message) {
    const error = new Error(data.message)
    error.data = data
    throw error
  }

  if (!data.token) {
    throw new Error('No token from GitHub!')
  }

  return data.token
}

// prompt the user for credentials
async function prompt (options) {
  const promptName = options.promptName || defaultPromptName
  const accessTokenUrl = options.accessTokenUrl || defaultAccessTokenUrl
  const scopes = options.scopes || defaultScopes
  const usernamePrompt = options.usernamePrompt || `Your ${promptName} username:`
  const tokenQuestionPrompt = options.tokenQuestionPrompt || 'This appears to be a personal access token, is that correct? [y/n] '
  const passwordReplaceChar = options.passwordReplaceChar || defaultPasswordReplaceChar
  let passwordPrompt = options.passwordPrompt

  if (!passwordPrompt) {
    let patMsg = `You may either enter your ${promptName} password or use a 40 character personal access token generated at ${accessTokenUrl} ` +
      (scopes.length ? `with the following scopes: ${scopes.join(', ')}` : '(no scopes necessary)')
    patMsg = newlineify(80, patMsg)
    passwordPrompt = `${patMsg}\nYour ${promptName} password:`
  }

  // username

  const user = await read({ prompt: usernamePrompt })
  if (user === '') {
    return
  }

  // password || token

  const pass = await read({ prompt: passwordPrompt, silent: true, replace: passwordReplaceChar })

  if (pass.length === 40) {
    // might be a token?
    do {
      const yorn = await read({ prompt: tokenQuestionPrompt })

      if (yorn.toLowerCase() === 'y') {
        // a token, apparently we have everything
        return { user, token: pass, pass: null, otp: null }
      }

      if (yorn.toLowerCase() === 'n') {
        break
      }
    } while (true)
  }

  // username + password
  // check for 2FA, this may trigger an SMS if the user set it up that way
  const reqOptions = {
    headers: { 'User-Agent': options.userAgent || defaultUA },
    method: 'post',
    auth: user + ':' + pass
  }
  const authUrl = options.authUrl || defaultAuthUrl

  const response = await new Promise((resolve, reject) => {
    hyperquest(authUrl, reqOptions, (err, response) => {
      if (err) {
        return reject(err)
      }
      resolve(response)
    }).end()
  })

  const otpHeader = response.headers['x-github-otp']

  if (!otpHeader || otpHeader.indexOf('required') < 0) {
    // no 2FA required
    return { user, pass, token: null, otp: null }
  }

  // 2FA required
  const otp = await read({ prompt: 'Your GitHub OTP/2FA Code (optional):' })

  return { user, pass, otp }
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
    const authData = await promisify(config.read.bind(config))()
    if (authData && authData.user && authData.token) {
      // we had it saved in a config file
      return authData
    }
  }

  let data = await prompt(options) // prompt the user for data
  data = Object.assign(options, data)

  let token = data.token

  if (!token) {
    token = await createAuth(data) // create a token from the GitHub API
  }

  const tokenData = { user: data.user, token }

  if (options.noSave) {
    return tokenData
  }

  process.umask(0o077)
  await promisify(config.write.bind(config))(tokenData)

  process.stdout.write(`Wrote access token to "${config.filePath}"\n`)

  return tokenData
}

module.exports = function ghauth (options, callback) {
  if (typeof callback !== 'function') {
    return auth(options) // promise, it can be awaited
  }

  auth(options).then((data) => callback(null, data)).catch(callback)
}
