# ghauth

**Create and load persistent GitHub authentication tokens for command-line apps**

[![NPM](https://nodei.co/npm/ghauth.svg?style=flat&data=n,v&color=blue)](https://nodei.co/npm/ghauth/)

## Example usage

```js
import ghauth from 'ghauth'

const authData = await ghauth({
  configName: 'my-app',
  scopes: ['repo']
})

console.log(authData)
// { user: 'rvagg', token: 'ghp_...' }
```

On first run, this prompts the user to create a [Personal Access Token](https://github.com/settings/tokens). The token is saved to `~/.config/my-app/config.json` (Linux), `~/Library/Application Support/my-app/config.json` (macOS), or `%APPDATA%/my-app/config.json` (Windows). Subsequent runs return the cached token without prompting.

```console
$ node my-app.js
Personal access token auth for Github.

  Create a Personal Access Token at https://github.com/settings/tokens

    1. Click "Generate new token" → "Generate new token (classic)"
       (fine-grained tokens also work)
    2. Set a name, e.g. "my-app"
    3. Select scopes: repo
    4. Generate and copy the token

Paste your token here: ✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔✔
✔ Authorized for rvagg
Wrote access token to "/home/rvagg/.config/my-app/config.json"
{ user: 'rvagg', token: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }
```

## API

<b><code>ghauth(options)</code></b>

Returns a `Promise` that resolves to `{ user: String, token: String }`.

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `configName` | String | Yes* | Name for the config file. Creates `<configName>/config.json` in the user's config directory. *Not required if `noSave: true`. |
| `scopes` | Array | No | GitHub API [scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) your app requires. Defaults to `[]`. |
| `noSave` | Boolean | No | Don't persist the token to disk. |
| `clientId` | String | No | OAuth app client ID. If provided, uses device flow instead of PAT prompt. |
| `noDeviceFlow` | Boolean | No | Force PAT prompt even if `clientId` is provided. |
| `userAgent` | String | No | Custom User-Agent for GitHub API requests. |
| `passwordReplaceChar` | String | No | Character to echo when entering tokens. Defaults to `'✔'`. |
| `authUrl` | String | No | GitHub Enterprise auth URL (for GHE only). |
| `promptName` | String | No | Name shown in prompts for GHE. Defaults to `'GitHub Enterprise'`. |
| `note` | String | No | Note for the token (GHE only). |

### Token formats

ghauth accepts all GitHub PAT formats:
- **Classic PATs**: 40 hex characters or `ghp_` prefix
- **Fine-grained PATs**: `github_pat_` prefix

## OAuth Device Flow

If you register an [OAuth App](https://github.com/settings/developers) with GitHub, you can use the device flow instead of asking users to create PATs manually. This provides a smoother UX where users authorize in their browser.

```js
const authData = await ghauth({
  clientId: 'your-oauth-app-client-id',
  configName: 'my-app',
  scopes: ['repo']
})
```

To set up an OAuth App:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set any URL for the callback (it's not used by device flow)
4. Enable "Device Authorization Flow" in the app settings
5. Use the Client ID (not the secret) in your code

See [GitHub's device flow documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) for details.

## GitHub Enterprise

For GitHub Enterprise instances that use basic auth:

```js
const authData = await ghauth({
  configName: 'my-app',
  authUrl: 'https://github.mycompany.com/api/v3/authorizations',
  scopes: ['repo']
})
```

## v6 to v7 Migration

**Breaking Changes:**

1. **ESM only** - Update imports:
   ```javascript
   // Before (v6)
   const ghauth = require('ghauth')

   // After (v7)
   import ghauth from 'ghauth'
   ```

2. **Promise-only API** - Callbacks removed:
   ```javascript
   // Before (v6)
   ghauth(options, (err, data) => { ... })

   // After (v7)
   const data = await ghauth(options)
   ```

3. **Node.js 20+** required

4. **PAT flow is now the default** - No need for `noDeviceFlow: true` or `clientId`. Just provide `configName` and optional `scopes`.

5. **PAT validation updated** - Now accepts fine-grained PATs (`github_pat_` prefix) in addition to classic PATs.

## Contributing

ghauth is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See the [CONTRIBUTING.md](https://github.com/rvagg/ghauth/blob/master/CONTRIBUTING.md) file for more details.

### Contributors

ghauth is made possible by the excellent work of the following contributors:

<table><tbody>
<tr><th align="left">Rod Vagg</th><td><a href="https://github.com/rvagg">GitHub/rvagg</a></td><td><a href="http://twitter.com/rvagg">Twitter/@rvagg</a></td></tr>
<tr><th align="left">Jeppe Nejsum Madsen</th><td><a href="https://github.com/jeppenejsum">GitHub/jeppenejsum</a></td><td><a href="http://twitter.com/nejsum">Twitter/@nejsum</a></td></tr>
<tr><th align="left">Max Ogden</th><td><a href="https://github.com/maxogden">GitHub/maxogden</a></td><td><a href="http://twitter.com/maxogden">Twitter/@maxogden</a></td></tr>
<tr><th align="left">Bret Comnes</th><td><a href="https://github.com/bcomnes">GitHub/bcomnes</a></td><td><a href="http://twitter.com/bcomnes">Twitter/@bcomnes</a></td></tr>
</tbody></table>

## License

Copyright (c) 2014 ghauth contributors (listed above).

ghauth is licensed under the MIT license. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE.md file for more details.
