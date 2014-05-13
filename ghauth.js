const read       = require('read')
    , hyperquest = require('hyperquest')
    , bl         = require('bl')
    , path       = require('path')
    , fs         = require('fs')
    , mkdirp     = require('mkdirp')
    , xtend      = require('xtend')

const defaultUA     = 'Magic Node.js application that does magic things'
    , defaultScopes = []
    , defaultNote   = 'Node.js command-line app with ghauth'
    , authUrl       = 'https://api.github.com/authorizations'


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
    , note   : options.note   || defaultNote
  }))
}


function prompt (callback) {
  read({ prompt: 'Your GitHub username:' }, function (err, user) {
    if (err)
      return callback(err)

    if (user === '')
      return callback()

    read({ prompt: 'Your GitHub password:', silent: true, replace: '\u2714' }, function (err, pass) {
      if (err)
        return callback(err)

      read({ prompt: 'Your GitHub OTP/2FA Code (optional):' }, function (err, otp) {
        if (err)
          return callback(err)

        callback(null, { user: user, pass: pass, otp: otp })
      })
    })
  })
}

function auth (options, callback) {
  var configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', options.configName + '.json')
    , authData

  mkdirp.sync(path.dirname(configPath))

  try {
    authData = require(configPath)
  } catch (e) {}

  if (authData && authData.user && authData.token)
    return callback(null, authData)

  prompt(function (err, data) {
    if (err)
      return callback(err)

    createAuth(xtend(options, data), function (err, token) {
      if (err)
        return callback(err)

      var tokenData = { user: data.user, token: token }

      fs.writeFile(configPath, JSON.stringify(tokenData), 'utf8', function (err) {
        if (err)
          return callback(err)

        callback(null, tokenData)
      })
    })
  })
}

module.exports = auth
