# ghauth

**Create and load persistent GitHub authentication tokens for command-line apps**

[![NPM](https://nodei.co/npm/ghauth.png?mini=true)](https://nodei.co/npm/ghauth/)

## Example usage

```js
const ghauth = require('ghauth')
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
```

Will run something like this:

```
$ node awesome.js

GitHub username: rvagg
GitHub password: ✔✔✔✔✔✔✔✔✔✔✔✔
GitHub OTP (optional): 669684

{ user: 'rvagg',
  token: '24d5dee258c64aef38a66c0c5eca459c379901c2' }
```

Because the token is persisted, the next time you run it there will be no prompts:


```
$ node awesome.js

{ user: 'rvagg',
  token: '24d5dee258c64aef38a66c0c5eca459c379901c2' }
```

## License

**ghauth** is Copyright (c) 2014 Rod Vagg [@rvagg](https://github.com/rvagg) and licensed under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.
