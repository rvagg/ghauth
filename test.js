const assert = require('assert')
    , ghauth = require('./')


var e

try {
  ghauth()
} catch (_e) { e = _e }

assert(e, 'got an error calling with no args')
assert.equal('TypeError', e.name, 'got a type error calling with no args')

e = null
try {
  ghauth({})
} catch (_e) { e = _e }

assert(e, 'got an error calling with only options arg')
assert.equal('TypeError', e.name, 'got a type error calling with only options arg')
assert(/callback/.test(e.message), 'got an error about needing a "callback" arg')

e = null
try {
  ghauth({}, function () {})
} catch (_e) { e = _e }

assert(e, 'got an error calling with empty options arg')
assert.equal('TypeError', e.name, 'got a type error calling with empty options arg')
assert(/configName/.test(e.message), 'got an error about needing a "configName" property')

// ... todo, moar tests, with mock GH API and mock out the read()s