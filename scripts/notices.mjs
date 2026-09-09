import fs from 'node:fs/promises'
import path from 'node:path'
const blocks=['onlysubs 0.3.0 — WickWorks\nThird-party notices\n\nElectron includes Chromium and Node.js; see the accompanying LICENSE.electron.txt and LICENSES.chromium.html. This all-in-one preview also distributes an unmodified FFmpeg 9.0.1 GPLv3 build and a PyInstaller-packaged Python/faster-whisper runtime as separate executable programs. See resources/engines for FFmpeg licence and build information. Speech model weights download separately on first use.']
for(const name of ['react','react-dom','scheduler','loose-envify','js-tokens','electron','electron-updater']){
 const dir=path.resolve('node_modules',name)
 const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'))
 const files=await fs.readdir(dir),license=files.find(f=>/^licen[cs]e(\.|$)/i.test(f))
 if(!license)throw new Error('Missing licence for '+name)
 blocks.push(`${name} ${pkg.version}\n${await fs.readFile(path.join(dir,license),'utf8')}`)
}
await fs.mkdir('work',{recursive:true});await fs.writeFile('work/THIRD-PARTY-NOTICES.txt',blocks.join('\n\n------------------------------\n\n'))
