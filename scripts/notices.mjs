import fs from 'node:fs/promises'
import path from 'node:path'
const blocks=['onlysubs 0.2.0 — WickWorks\nThird-party notices\n\nElectron includes Chromium and Node.js; see the accompanying LICENSE.electron.txt and LICENSES.chromium.html. Processing engines and model weights are installed separately, not bundled.']
for(const name of ['react','react-dom','scheduler','loose-envify','js-tokens','electron']){
 const dir=path.resolve('node_modules',name)
 const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'))
 const files=await fs.readdir(dir),license=files.find(f=>/^licen[cs]e(\.|$)/i.test(f))
 if(!license)throw new Error('Missing licence for '+name)
 blocks.push(`${name} ${pkg.version}\n${await fs.readFile(path.join(dir,license),'utf8')}`)
}
await fs.mkdir('work',{recursive:true});await fs.writeFile('work/THIRD-PARTY-NOTICES.txt',blocks.join('\n\n------------------------------\n\n'))
