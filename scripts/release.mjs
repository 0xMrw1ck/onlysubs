import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
const pkg=JSON.parse(await fs.readFile('package.json','utf8')),name=`onlysubs-${pkg.version}-windows-x64.exe`
await fs.mkdir('outputs/windows',{recursive:true});await fs.mkdir('outputs/website/downloads',{recursive:true})
const source=path.resolve(process.argv[2]||'work/windows-build',name)
const hash=createHash('sha256').update(await fs.readFile(source)).digest('hex')
for(const folder of ['outputs/windows','outputs/website/downloads']){
 await fs.copyFile(source,path.join(folder,name))
 await fs.writeFile(path.join(folder,'SHA256SUMS.txt'),hash+'  '+name+'\n')
 await fs.copyFile('work/THIRD-PARTY-NOTICES.txt',path.join(folder,'THIRD-PARTY-NOTICES.txt'))
}
console.log(JSON.stringify({name,sha256:hash,bytes:(await fs.stat(source)).size}))
