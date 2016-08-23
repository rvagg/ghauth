const read       = require('read')
    , hyperquest = require('hyperquest')
    , bl         = require('bl')
    , path       = require('path')
    , fs         = require('fs')
    , mkdirp     = require('mkdirp')
    , xtend      = require('xtend')
    , appCfg     = require('application-config')

const defaultUA         = 'Magic Node.js application that does magic things with ghauth'
    , defaultScopes     = []
    , defaultNote       = 'Node.js command-line app with ghauth'
    , defaultAuthUrl    = 'https://api.github.com/authorizations'
    , defaultPromptName = 'GitHub'


function createAuth (options, callback) {
  var reqOptions  = {
          headers : {
              'X-GitHub-OTP' : options.otp       || null
            , 'User-Agent'   : options.userAgent || defaultUA
            , 'Content-type' : 'application/json'
          }
        , method  : 'post'
        , auth    : options.user + ':' + options.pass
      }
    , authUrl     = options.authUrl || defaultAuthUrl
    , currentDate = new Date().toJSON()
    , req         = hyperquest(authUrl, reqOptions)

  req.pipe(bl(afterCreateAuthResponse))

  function afterCreateAuthResponse (err, data) {
    if (err)
      return callback(err)

    data = JSON.parse(data.toString())

    if (data.message) {
      var error = new Error(data.message)
      error.data = data
      return callback(error)
    }
    if (!data.token)
      return callback(new Error('No token from GitHub!'))

    callback(null, data.token)
  }

  req.end(JSON.stringify({
      scopes : options.scopes || defaultScopes
    , note   : (options.note  || defaultNote) + ' (' + currentDate + ')'
  }))
}


function prompt (options, callback) {
  var promptName     = options.promptName || defaultPromptName
    , usernamePrompt = 'Your ' + promptName + ' username:'
    , passwordPrompt = 'Your ' + promptName + ' password:'
    , user
    , pass

  read({ prompt: usernamePrompt }, afterUsernameRead)

  function afterUsernameRead (err, _user) {
    if (err)
      return callback(err)

    if (_user === '')
      return callback()

    user = _user

    read({ prompt: passwordPrompt, silent: true, replace: '\u2714' }, afterPasswordRead)
  }

  function afterPasswordRead (err, _pass) {
    if (err)
      return callback(err)

    pass = _pass

    // Check for 2FA. This triggers an SMS if needed
    var reqOptions = {
            headers : {
              'User-Agent' : options.userAgent || defaultUA
            }
          , method  : 'post'
          , auth    : user + ':' + pass
        }
      , authUrl   = options.authUrl || defaultAuthUrl

    hyperquest(authUrl, reqOptions, after2FaResponse).end();
  }

  function after2FaResponse (err, response) {
    if (err)
      return callback(err)

    var otp = response.headers['x-github-otp']

    if (!otp || otp.indexOf('required') < 0)
      return callback(null, { user: user, pass: pass, otp: null })

    read({ prompt: 'Your GitHub OTP/2FA Code (optional):' }, afterOtpRead)
  }

  function afterOtpRead (err, otp) {
    if (err)
      return callback(err)

    callback(null, { user: user, pass: pass, otp: otp })
  }
}


function auth (options, callback) {
  if (typeof options != 'object')
    throw new TypeError('ghauth requires an options argument')

  if (typeof callback != 'function')
    throw new TypeError('ghauth requires a callback argument')

  var config

  if (!options.noSave) {
    if (typeof options.configName != 'string')
      throw new TypeError('ghauth requires an options.configName property')

    config = appCfg(options.configName)
    config.read(afterConfigRead)
  } else {
    prompt(options, afterPrompt)
  }

  function afterConfigRead (err, authData) {
    if (err)
      return callback(err)

    if (authData && authData.user && authData.token)
      return callback(null, authData)

    prompt(options, afterPrompt)
  }

  function afterPrompt (err, data) {
    if (err)
      return callback(err)

    createAuth(xtend(options, data), afterCreateAuth)

    function afterCreateAuth (err, token) {
      if (err)
        return callback(err)

      var tokenData = { user: data.user, token: token }

      if (options.noSave)
        return callback(null, tokenData)

      process.umask(0o077);
      config.write(tokenData, afterWrite)

      function afterWrite (err) {
        if (err)
          return callback(err)

        callback(null, tokenData)
      }
    }
  }
}


module.exports = auth
