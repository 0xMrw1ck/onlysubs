import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
await fs.mkdir('work',{recursive:true})
process.env.REEL_DATA_ROOT=await fs.mkdtemp(path.resolve('work/api-test-'))
const {createApi}=require('../server/api.cjs')
test('range downloads, persisted editor state, interrupted job recovery',async()=>{
 const api=createApi(),server=http.createServer(api)
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const url='http://127.0.0.1:'+server.address().port
 try{
   const dir=path.join(process.env.REEL_DATA_ROOT,'work/jobs/test-export')
   await fs.mkdir(dir,{recursive:true})
   const media=path.join(dir,'video.mp4');await fs.writeFile(media,'abcdefghij')
   await fs.writeFile(path.join(dir,'status.json'),JSON.stringify({id:'test-export',status:'complete',result:{files:[{path:media}]}}))
   const partial=await fetch(url+'/download?job=test-export&index=0',{headers:{Range:'bytes=2-4'}})
   assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 2-4/10');assert.equal(await partial.text(),'cde')
   const download=await fetch(url+'/download?job=test-export&index=0&save=1')
   assert.match(download.headers.get('content-disposition'),/attachment/);assert.equal((await download.arrayBuffer()).byteLength,10)
   const invalid=await fetch(url+'/download?job=test-export&index=0',{headers:{Range:'bytes=20-30'}});assert.equal(invalid.status,416)
   const edits={transcript:[{text:'Saved correction'}],clips:[{selected:false}]}
   assert.equal((await fetch(url+'/editor/test-export',{method:'PUT',body:JSON.stringify(edits)})).status,200)
   assert.deepEqual(await (await fetch(url+'/editor/test-export')).json(),edits)
   assert.deepEqual(await (await fetch(url+'/editor/latest')).json(),edits)
   await fs.writeFile(path.join(dir,'status.json'),JSON.stringify({id:'test-export',status:'processing'}))
   assert.equal((await (await fetch(url+'/jobs/test-export')).json()).status,'interrupted')
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
test('confirmed deletion frees only generated files, preserves indexes and survives reload',async()=>{
 const server=http.createServer(createApi());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const url='http://127.0.0.1:'+server.address().port,root=process.env.REEL_DATA_ROOT
 const folder=path.join(root,'outputs/export-12345-abcd'),dir=path.join(root,'work/jobs/delete-test'),source=path.join(root,'source.mp4')
 await fs.mkdir(folder,{recursive:true});await fs.mkdir(dir,{recursive:true})
 await fs.writeFile(source,'source-kept')
 const files=[0,1].map(i=>({name:`${i+1}-clip.mp4`,path:path.join(folder,`${i+1}-clip.mp4`),duration:1}))
 for(const file of files)await fs.writeFile(file.path,'abcdefghij')
 for(const i of [1,2])await fs.writeFile(path.join(folder,`captions-${i}.ass`),'subtitle')
 const job={id:'delete-test',type:'export',status:'complete',video:source,result:{folder,files}}
 const status=path.join(dir,'status.json');await fs.writeFile(status,JSON.stringify(job))
 await fs.writeFile(path.join(dir,'editor.json'),JSON.stringify({exports:[{jobId:job.id,...job.result}]}))
 const remove=(index,confirm=true)=>fetch(url+'/exports/delete-test/'+index,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm})})
 try{
   const listing=await (await fetch(url+'/exports')).json()
   assert.equal(listing.files.length,2);assert.equal(listing.totalBytes,20)
   assert.equal((await remove(0,false)).status,400);assert.equal((await fs.stat(files[0].path)).size,10)
   const response=await remove(0),result=await response.json();assert.equal(response.status,200);assert.equal(result.freedBytes,18)
   await assert.rejects(fs.stat(files[0].path),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(folder,'captions-1.ass')),{code:'ENOENT'})
   assert.equal(await fs.readFile(source,'utf8'),'source-kept');assert.equal((await fs.stat(files[1].path)).size,10)
   assert.equal((await fs.stat(path.join(folder,'captions-2.ass'))).size,8)
   assert.ok(JSON.parse(await fs.readFile(status,'utf8')).result.files[0].deletedAt)
   assert.equal((await fetch(url+'/download?job=delete-test&index=0')).status,410)
   assert.equal((await fetch(url+'/download?job=delete-test&index=1')).status,200)
   assert.equal((await (await remove(0)).json()).freedBytes,0)
   assert.equal((await (await fetch(url+'/exports')).json()).files[0].index,1)
   assert.equal((await remove(-1)).status,400)
   // A stale editor save cannot clear the authoritative job tombstone.
   await fetch(url+'/editor/delete-test',{method:'PUT',body:JSON.stringify({exports:[job.result]})})
   assert.ok((await (await fetch(url+'/jobs/delete-test')).json()).result.files[0].deletedAt)
   assert.equal((await remove(1)).status,200);await assert.rejects(fs.stat(folder),{code:'ENOENT'})
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})

test('deletion refuses source paths, folder junctions, and unfinished jobs',async()=>{
 const {deleteFile}=require('../server/export-storage.cjs'),root=process.env.REEL_DATA_ROOT
 const folder=path.join(root,'outputs/export-23456-abcd'),outside=path.join(root,'protected.mp4')
 await fs.mkdir(folder,{recursive:true});await fs.writeFile(outside,'keep')
 const job={type:'export',status:'complete',video:outside,result:{folder,files:[{path:outside}]}}
 await assert.rejects(deleteFile(job,0,async()=>{}),/source/)
 await assert.rejects(deleteFile({...job,video:'another-source.mp4'},0,async()=>{}),/outside/)
 await assert.rejects(deleteFile({...job,status:'processing'},0,async()=>{}),/completed/)
 const linked=path.join(root,'outputs/export-34567-abcd')
 await fs.symlink(folder,linked,'junction')
 await assert.rejects(deleteFile({...job,result:{folder:linked,files:[{path:path.join(linked,'video.mp4')}]}},0,async()=>{}),/links/)
 assert.equal(await fs.readFile(outside,'utf8'),'keep')
})
