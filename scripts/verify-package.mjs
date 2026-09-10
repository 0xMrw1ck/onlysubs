import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),asar=require('@electron/asar')
const root=path.resolve(process.argv[2]||'work/windows-reviewed/win-unpacked'),file=path.join(root,'resources/app.asar')
const entries=asar.listPackage(file)
for(const entry of entries)assert.doesNotMatch(entry.replaceAll('\\','/'),/^\/(work|outputs|site|tests)(\/|$)/,'Private/test data in desktop package')
for(const name of ['electron/main.cjs','electron/updates.cjs','server/api.cjs','server/start.cjs','server/security.cjs','shared/policies.mjs'])assert.deepEqual(asar.extractFile(file,name),await fs.readFile(name),name+' must match tested source')
assert.equal(JSON.parse(asar.extractFile(file,'package.json')).version,JSON.parse(await fs.readFile('package.json','utf8')).version)
assert.match(await fs.readFile(path.join(root,'resources/app-update.yml'),'utf8'),/repo: onlysubs/)
assert.ok(entries.some(p=>p.replaceAll('\\','/').endsWith('/electron-updater/package.json')))
for(const name of ['LICENSE.electron.txt','LICENSES.chromium.html','THIRD-PARTY-NOTICES.txt','resources/app.asar.unpacked/server/transcribe.py','resources/engines/ffmpeg.exe','resources/engines/ffprobe.exe','resources/engines/onlysubs-transcriber/onlysubs-transcriber.exe','resources/engines/FFMPEG-GPL-3.0.txt','resources/engines/FFMPEG-BUILD-INFO.txt'])await fs.access(path.join(root,name))
assert.match(asar.extractFile(file,'shared/policies.mjs').toString(),/Philippines/)
console.log('PACKAGE_VERIFIED: current source, licence notices, unpacked transcriber, no user media/jobs')
