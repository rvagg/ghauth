# ghauth

**Create and load persistent GitHub authentication tokens for command-line apps**

[![NPM](https://nodei.co/npm/ghauth.png?mini=true)](https://nodei.co/npm/ghauth/)

## Example usage

```js
const ghauth = require('ghauth')
    , authOptions = {
           // awesome.json within the user's config directory will store the token
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

## API

<b><code>ghauth(options, callback)</code></b>

The <b><code>options</code></b> argument can have the following properties:

* `configName` (String, required unless `noSave` is `true`): the name of the config you are creating, this is required for saving a `<configName>.json` file into the users config directory with the token created. Note that the **config directory is determined by [application-config](https://github.com/LinusU/node-application-config) and is OS-specific.**
* `noSave` (Boolean, optional): if you don't want to persist the token to disk, set this to `true` but be aware that you will still be creating a saved token on GitHub that will need cleaning up if you are not persisting the token.
* `authUrl` (String, optional):  defaults to `https://api.github.com/authorizations` for public GitHub but can be configured for private GitHub Enterprise endpoints.
* `promptName` (String, optional): defaults to `'GitHub'`, change this if you are prompting for GHE credentials.
* `scopes` (Array, optional): defaults to `[]`, consult the GitHub [scopes](https://developer.github.com/v3/oauth/#scopes) documentation to see what you may need for your application.
* `note` (String, optional):  defaults to `'Node.js command-line app with ghauth'`, override if you want to save a custom note with the GitHub token (user-visible).
* `userAgent` (String, optional): defaults to `'Magic Node.js application that does magic things with ghauth'`, only used for requests to GitHub, override if you have a good reason to do so.

The <b><code>callback</code></b> will be called with either an `Error` object describing what went wrong, or a `data` object as the second argument if the auth creation (or cache read) was successful. The shape of the second argument is `{ user:String, token:String }`.

# Contributing

ghauth is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See the [CONTRIBUTING.md](https://github.com/rvagg/ghauth/blob/master/CONTRIBUTING.md) file for more details.

### Contributors

ghauth is made possible by the excellent work of the following contributors:

<table><tbody>
<tr><th align="left">Rod Vagg</th><td><a href="https://github.com/rvagg">GitHub/rvagg</a></td><td><a href="http://twitter.com/rvagg">Twitter/@rvagg</a></td></tr>
<tr><th align="left">Jeppe Nejsum Madsen</th><td><a href="https://github.com/jeppenejsum">GitHub/jeppenejsum</a></td><td><a href="http://twitter.com/nejsum">Twitter/@nejsum</a></td></tr>
<tr><th align="left">Max Ogden</th><td><a href="https://github.com/maxogden">GitHub/maxogden</a></td><td><a href="http://twitter.com/maxogden">Twitter/@maxogden</a></td></tr>
</tbody></table>

License &amp; copyright
-------------------

Copyright (c) 2014 ghauth contributors (listed above).

ghauth is licensed under the MIT license. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE.md file for more details.
