import { build, createTargets, Platform } from 'electron-builder'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
const { values } = parseArgs({ options: { mac: { type: 'boolean' }, win: { type: 'boolean' }, arch: { type: 'string' } } })
if (values.mac && values.win) throw new Error('한 번에 하나의 OS를 선택하세요: --mac 또는 --win')
const platform = values.mac ? Platform.MAC : values.win ? Platform.WINDOWS : Platform.current()
const arch = values.arch || (values.win ? 'x64' : process.arch)
if (!['arm64', 'x64'].includes(arch)) throw new Error('지원 CPU: arm64, x64')
if (values.mac && process.platform !== 'darwin') throw new Error('DMG는 macOS에서 빌드하세요.')
const target = values.mac ? 'dmg' : values.win ? 'nsis' : 'dir'
const metadata = JSON.parse(await readFile('package.json', 'utf8'))
const staging = await mkdtemp(path.join(os.tmpdir(), 'branchline-package-'))
try {
  // Renderer dependencies are already bundled by Vite; main/preload use only Node and Electron.
  await cp('dist', path.join(staging, 'dist'), { recursive: true })
  await cp('electron', path.join(staging, 'electron'), { recursive: true, filter: source => !source.endsWith('.test.cjs') })
  const { name, version, type, main, description, author } = metadata
  await writeFile(path.join(staging, 'package.json'), JSON.stringify({ name, version, type, main, description, author }))
  const outputs = await build({ projectDir: staging, targets: createTargets([platform], target, arch), publish: 'never', config: {
    appId: 'dev.branchline.desktop', productName: 'Branchline', executableName: 'Branchline',
    electronVersion: metadata.devDependencies.electron, asar: true, npmRebuild: false,
    directories: { output: path.resolve('release'), buildResources: path.resolve('build') },
    files: ['dist/**/*', 'electron/**/*', 'package.json'],
    artifactName: 'Branchline-${version}-${os}-${arch}.${ext}',
    // Local installers deliberately use no developer certificate or publishing credentials.
    mac: { category: 'public.app-category.developer-tools', identity: null, notarize: false },
    dmg: { backgroundColor: '#fafafa', contents: [{ x: 140, y: 160, type: 'file' }, { x: 400, y: 160, type: 'link', path: '/Applications' }] },
    win: { target: 'nsis', signtoolOptions: { sign: async () => {} } },
    nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, runAfterFinish: false, deleteAppDataOnUninstall: false, createDesktopShortcut: true, artifactName: 'Branchline-${version}-win-${arch}-setup.${ext}' },
    publish: null,
  } })
  console.log(`Local build (${platform.name}/${arch}):\n${outputs.join('\n') || path.resolve('release')}\nDeveloper signing, notarization and publication are separate release steps.`)
} finally { await rm(staging, { recursive: true, force: true }) }
