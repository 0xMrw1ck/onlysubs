import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {createSession}=require('../server/security.cjs')
const {serveFile}=require('../server/api.cjs')
test('non-ASCII session header is rejected without throwing',()=>{
 assert.equal(createSession().authorize({headers:{'x-onlysubs-session':'é'.repeat(64)}}),false)
})
test('downloads reject directory junctions leading to private files',async()=>{
 const root=await fs.mkdtemp(path.resolve('work/download-security-'))
 await fs.mkdir(path.join(root,'private'))
 await fs.writeFile(path.join(root,'private','video.mp4'),'private-data')
 await fs.symlink(path.join(root,'private'),path.join(root,'linked'),'junction')
 await assert.rejects(serveFile({headers:{}},{},path.join(root,'linked','video.mp4')),/Linked media/)
 await fs.unlink(path.join(root,'linked'))
})
test('FFprobe rejects network references inside disguised video playlists',async()=>{
 const {probe,saveSettings}=require('../server/local-pipeline.cjs')
 // Use the real bundled decoder without persisting test settings.
 const bin=path.resolve('work/engines/ffprobe.exe')
 try{await fs.access(bin)}catch{return}
 const {run}=require('../server/local-pipeline.cjs')
 let requests=0
 const server=http.createServer((_req,res)=>{requests++;res.end('unexpected')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const root=await fs.mkdtemp(path.resolve('work/playlist-security-'))
 const file=path.join(root,'disguised.mp4')
 await fs.writeFile(file,'#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nhttp://127.0.0.1:'+server.address().port+'/secret.ts\n#EXT-X-ENDLIST\n')
 try{
 await assert.rejects(run(bin,['-protocol_whitelist','file,pipe','-v','error','-show_format',file]))
 assert.equal(requests,0)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})
