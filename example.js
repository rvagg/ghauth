import ghauth from './ghauth.js'

const authData = await ghauth({
  configName: 'ghauth-example',
  scopes: ['repo']
})

console.log(authData)
