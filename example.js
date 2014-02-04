const ghauth = require('./')
    , authOptions = {
           // ~/.config/awesome.json will store the token
          configName : 'awesome'

          // (optional) whatever GitHub auth scopes you require
        , scopes     : [ 'user' ]

          // (optional) saved with the token on GitHub
        , note       : 'This token is for my awesome app'

          // (optional)
        , userAgent  : 'My Awesome App'
      }

ghauth(authOptions, function (err, authData) {
  console.log(authData)
})
