const ghauth = require('./')
const authOptions = {
  // provide a clientId from a Github oAuth application registration
  clientId: '123456',

  // ~/.config/awesome.json will store the token
  configName: 'awesome',

  // (optional) whatever GitHub auth scopes you require
  scopes: ['user'],

  // (optional)
  userAgent: 'My Awesome App'
}

ghauth(authOptions, function (err, authData) {
  if (err) throw err
  console.log(authData)
})
