import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir, platform } from 'node:os'

function getConfigPath (name) {
  const home = homedir()
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', name, 'config.json')
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), name, 'config.json')
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), name, 'config.json')
  }
}

export function createConfig (name) {
  const filePath = getConfigPath(name)
  return {
    filePath,
    async read () {
      try {
        return JSON.parse(await readFile(filePath, 'utf8'))
      } catch (err) {
        if (err.code === 'ENOENT') return null
        throw err
      }
    },
    async write (data) {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(data, null, 2))
    }
  }
}
