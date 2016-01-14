const read       = require('read')
    , hyperquest = require('hyperquest')
    , bl         = require('bl')
    , xtend      = require('xtend')
    , appCfg     = require('application-config')

const defaultUA         = 'Magic Node.js application that does magic things with ghauth'
    , defaultScopes     = []
    , defaultNote       = 'Node.js command-line app with ghauth'
    , defaultAuthUrl    = 'https://api.github.com/authorizations'
    , defaultPromptName = 'GitHub'
    , defaultAccessTokenUrl = 'https://github.com/settings/tokens'
    , defaultPasswordReplaceChar = '\u2714'


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


function newlineify (len, str) {
  var s = ''
    , l = 0
    , sa = str.split(' ')

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


function prompt (options, callback) {
  var promptName     = options.promptName || defaultPromptName
    , accessTokenUrl = options.accessTokenUrl || defaultAccessTokenUrl
    , scopes         = options.scopes || defaultScopes
    , usernamePrompt = options.usernamePrompt ||
                       'Your ' + promptName + ' username:'
    , passwordPrompt = options.passwordPrompt ||
                       newlineify(80, 'You may either enter your ' +
                          promptName +
                          ' password or use a 40 character personal access token generated at ' +
                          accessTokenUrl +
                          (scopes.length
                            ? ' with the following scopes: ' + scopes.join(', ')
                            : ' (no scopes necessary)'
                          )) +
                       '\nYour ' + promptName + ' password:'
    , tokenQuestionPrompt = options.tokenQuestionPrompt ||
                            'This appears to be a personal access token, is that correct? [y/n] '
    , passwordReplaceChar = options.passwordReplaceChar || defaultPasswordReplaceChar
    , user
    , pass

  read({ prompt: usernamePrompt }, afterUsernameRead)

  function afterUsernameRead (err, _user) {
    if (err)
      return callback(err)

    if (_user === '')
      return callback()

    user = _user

    read({ prompt: passwordPrompt, silent: true, replace: passwordReplaceChar }, afterPasswordRead)
  }

  function promptTokenQuestion () {
    read({ prompt: tokenQuestionPrompt }, afterTokenPrompt)

    function afterTokenPrompt (err, _yorn) {
      if (err)
        return callback(err)

      if (!(/^[yn]$/i).test(_yorn))
        return promptTokenQuestion()

      if (_yorn.toLowerCase() == 'y')
        return callback(null, { user: user, token: pass, pass: null, otp: null })

      attemptAuth()
    }
  }

  function afterPasswordRead (err, _pass) {
    if (err)
      return callback(err)

    pass = _pass

    if (pass.length == 40)
      return promptTokenQuestion()

    attemptAuth()
  }

  function attemptAuth () {
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
      return callback(null, { user: user, pass: pass, token: null, otp: null })

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

    data = xtend(options, data)

    if (data.token)
      return afterCreateAuth(null, data.token)

    createAuth(data, afterCreateAuth)

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

        process.stdout.write('Wrote access token to ' + config.filePath + '\n')

        callback(null, tokenData)
      }
    }
  }
}


module.exports = auth
