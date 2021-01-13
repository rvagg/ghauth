# ghauth

**Create and load persistent GitHub authentication tokens for command-line apps**

[![NPM](https://nodei.co/npm/ghauth.svg)](https://nodei.co/npm/ghauth/)

**Important**

Github deprecated their basic username/password auth api and have [scheduled to sunset it November 13, 2020](https://developer.github.com/changes/2020-02-14-deprecating-oauth-auth-endpoint/).  `ghauth` v5.0.0+ supports the new [device auth flow](https://docs.github.com/en/developers/apps/authorizing-oauth-apps#device-flow) but requires some implementation changes and application registration with Github. Review the new API docs and see [Setup](#setup) for a simple upgrade guide between v4 and v5.

## Example usage

```js
const ghauth = require('ghauth')
const authOptions = {
  // provide a clientId from a Github oAuth application registration
  clientId: '123456',

  // awesome.json within the user's config directory will store the token
  configName: 'awesome',

  // (optional) whatever GitHub auth scopes you require
  scopes: [ 'user' ],

  // (optional)
  userAgent: 'My Awesome App'
}

const authData = await ghauth(authOptions)
console.log(authData)

// can also be run with a callback as:
//
// ghauth(authOptions, function (err, authData) {
//  console.log(authData)
// })

```

Will run something like this:

```console
$ node awesome.js
  Authorize with GitHub by opening this URL in a browser:

    https://github.com/login/device

  and enter the following User Code:
  (or press ⏎ to enter a personal access token)

✔ Device flow complete.  Manage at https://github.com/settings/connections/applications/123456
✔ Authorized for rvagg
Wrote access token to "~/.config/awesome/config.json"
{
  token: '24d5dee258c64aef38a66c0c5eca459c379901c2',
  user: 'rvagg'
}
```

Because the token is persisted, the next time you run it there will be no prompts:

```console
$ node awesome.js

{ user: 'rvagg',
  token: '24d5dee258c64aef38a66c0c5eca459c379901c2' }
```

When `authUrl` is configured for a Github enterprise endpoint, it will look more like this:

```console
$ node awesome.js

GitHub username: rvagg
GitHub password: ✔✔✔✔✔✔✔✔✔✔✔✔
GitHub OTP (optional): 669684

{ user: 'rvagg',
  token: '24d5dee258c64aef38a66c0c5eca459c379901c2' }
```

## API

<b><code>ghauth(options, callback)</code></b>

The <b><code>options</code></b> argument can have the following properties:

* `clientId` (String, required unless `noDeviceFlow` is `true`): the clientId of your oAuth application on Github.  See [setup](#setup) below for more info on creating a Github oAuth application.
* `configName` (String, required unless `noSave` is `true`): the name of the config you are creating, this is required for saving a `<configName>.json` file into the users config directory with the token created. Note that the **config directory is determined by [application-config](https://github.com/LinusU/node-application-config) and is OS-specific.**
* `noSave` (Boolean, optional): if you don't want to persist the token to disk, set this to `true` but be aware that you will still be creating a saved token on GitHub that will need cleaning up if you are not persisting the token.
* `authUrl` (String, optional):  defaults to `null` since public Github no longer supports basic auth.  Setting `authUrl` will allow you to perform basic authentication with a Github Enterprise instance.  This setting is ignored if the `host` of the url is `api.github.com` or `github.com`.
* `promptName` (String, optional): defaults to `'GitHub Enterprise'`, change this if you are prompting for GHE credentials.  Not used for public GH authentication.
* `scopes` (Array, optional): defaults to `[]`, consult the GitHub [scopes](https://developer.github.com/v3/oauth/#scopes) documentation to see what you may need for your application.
* `note` (String, optional):  defaults to `'Node.js command-line app with ghauth'`, override if you want to save a custom note with the GitHub token (user-visible).  Only used with GHE basic authentication.
* `userAgent` (String, optional): defaults to `'Magic Node.js application that does magic things with ghauth'`, only used for requests to GitHub, override if you have a good reason to do so.
* `passwordReplaceChar` (String, optional): defaults to `'✔'`, the character echoed when the user inputs their password. Can be set to `''` to silence the output.
* `noDeviceFlow` (Boolean, optional): disable the Device Flow authentication method.  This will prompt users for a personal access token immediately if no existing configuration is found.  Only applies when `authUrl` is not used.

The <b><code>callback</code></b> will be called with either an `Error` object describing what went wrong, or a `data` object as the second argument if the auth creation (or cache read) was successful. The shape of the second argument is `{ user:String, token:String }`.

## Setup

Github requires a `clientId` from a Github oAuth Application in order to complete oAuth device flow authentication.

1. Register an "oAuth Application" with Github:
  - [Personal Account oAuth apps page](https://github.com/settings/developers)
  - `https://github.com/organizations/${org_name}/settings/applications`: Organization oAuth settings page.
2. Provide an application name, homepage URL and callback URL.  You can make these two URLs the same, since your app will not be using a callback URL with the device flow.
3. Go to your oAuth application's settings page and take note of the "Client ID" (this will get passed as `clientId` to `ghauth`).  You can ignore the "Client Secret" value.  It is not used.

The `clientId` is registered by the developer of the tool or CLI, and is baked into the code of your program.  Users do not need to set this up, onyl the publisher of the app.

- [Device flow docs](https://docs.github.com/en/developers/apps/authorizing-oauth-apps#device-flow)

### v4 to v5 Upgrade guide

- A `options.clientId` is required to use device flow.  Set up an oAuth application to get a `clientId`.
- the `options.authUrl` now only applies to GitHub enterprise authentication which still only supports basic auth.  Only pass this if you intend for GitHub Enterpise authentication.
- `options.note` is only used for GHE basic auth now.  Your oAuth application details serve the purpose of token note.
- `options.noDeviceFlow` is available to skip the device flow if you are unable to create a `clientId` for some reason, and wish to skip to the personal access token input prompt immediately.

## Contributing

ghauth is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See the [CONTRIBUTING.md](https://github.com/rvagg/ghauth/blob/master/CONTRIBUTING.md) file for more details.

### A note about tests

... there are no proper tests yet unfortunately. If you would like to contribute some that would be very helpful! We need to mock the GitHub API to properly test the functionality. Otherwise, testing of this library is done by its use downstream.

### Contributors

ghauth is made possible by the excellent work of the following contributors:

<table><tbody>
<tr><th align="left">Rod Vagg</th><td><a href="https://github.com/rvagg">GitHub/rvagg</a></td><td><a href="http://twitter.com/rvagg">Twitter/@rvagg</a></td></tr>
<tr><th align="left">Jeppe Nejsum Madsen</th><td><a href="https://github.com/jeppenejsum">GitHub/jeppenejsum</a></td><td><a href="http://twitter.com/nejsum">Twitter/@nejsum</a></td></tr>
<tr><th align="left">Max Ogden</th><td><a href="https://github.com/maxogden">GitHub/maxogden</a></td><td><a href="http://twitter.com/maxogden">Twitter/@maxogden</a></td></tr>
<tr><th align="left">Bret Comnes</th><td><a href="https://github.com/bcomnes">GitHub/bcomnes</a></td><td><a href="http://twitter.com/bcomnes">Twitter/@bcomnes</a></td></tr>
</tbody></table>

License &amp; copyright
-----------------------

Copyright (c) 2014 ghauth contributors (listed above).

ghauth is licensed under the MIT license. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE.md file for more details.
