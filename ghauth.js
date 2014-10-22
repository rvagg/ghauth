const read       = require('read')
    , hyperquest = require('hyperquest')
    , bl         = require('bl')
    , path       = require('path')
    , fs         = require('fs')
    , mkdirp     = require('mkdirp')
    , xtend      = require('xtend')

const defaultUA      = 'Magic Node.js application that does magic things'
    , defaultScopes  = []
    , defaultNote    = 'Node.js command-line app with ghauth'
    , defaultAuthUrl = 'https://api.github.com/authorizations'


function createAuth (options, callback) {
  var reqOptions = {
      headers : {
          'X-GitHub-OTP' : options.otp       || null
        , 'User-Agent'   : options.userAgent || defaultUA
        , 'Content-type' : 'application/json'
      }
    , method  : 'post'
    , auth    : options.user + ':' + options.pass
  }
  var authUrl = options.authUrl || defaultAuthUrl
  
  var currentDate = new Date().toJSON()

  var req = hyperquest(authUrl, reqOptions)

  req.pipe(bl(function (err, data) {
    if (err)
      return callback(err)

    data = JSON.parse(data.toString())

    if (data.message)
      return callback(new Error(JSON.stringify(data)))
    if (!data.token)
      return callback(new Error('No token from GitHub!'))

    callback(null, data.token)
  }))

  req.end(JSON.stringify({
      scopes : options.scopes || defaultScopes
    , note   : (options.note  || defaultNote) + ' (' + currentDate + ')'
  }))
}


function prompt (options, callback) {
  var promptName = options.promptName || 'GitHub'
  var usernamePrompt = 'Your ' + promptName + ' username:'
  var passwordPrompt = 'Your ' + promptName + ' password:'
  read({ prompt: usernamePrompt }, function (err, user) {
    if (err)
      return callback(err)

    if (user === '')
      return callback()

    read({ prompt: passwordPrompt, silent: true, replace: '\u2714' }, function (err, pass) {
      if (err)
        return callback(err)

        // Check for 2FA. This triggers an SMS if needed
        var reqOptions = {
          headers : {
              'User-Agent'       : options.userAgent || defaultUA
          }
          , method  : 'post'
          , auth    : user + ':' + pass
        }
        var authUrl = options.authUrl || defaultAuthUrl
        var req = hyperquest(authUrl, reqOptions, function (err, response) {
          if (err)
            return callback(err)

          var otp = response.headers['x-github-otp']
          if (!otp || otp.indexOf('required') < 0)
            return callback(null, { user: user, pass: pass, otp: null })

          read({ prompt: 'Your GitHub OTP/2FA Code (optional):' }, function (err, otp) {
            if (err)
              return callback(err)

            callback(null, { user: user, pass: pass, otp: otp })
          })
        })
      req.end();
    })
  })
}

function auth (options, callback) {
  var configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', options.configName + '.json')
    , authData

  if (!options.noSave) {

    mkdirp.sync(path.dirname(configPath))

    try {
      authData = require(configPath)
    } catch (e) {}

    if (authData && authData.user && authData.token)
      return callback(null, authData)

  }
  
  prompt(options, function (err, data) {
    if (err)
      return callback(err)

    createAuth(xtend(options, data), function (err, token) {
      if (err)
        return callback(err)

      var tokenData = { user: data.user, token: token }

      if (options.noSave) 
        return callback(null, tokenData)
      
      fs.writeFile(configPath, JSON.stringify(tokenData), 'utf8', function (err) {
        if (err)
          return callback(err)

        callback(null, tokenData)
      })
    })
  })
}

module.exports = auth
