import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
process.env.REEL_DATA_ROOT=await fs.mkdtemp(path.resolve('work/security-test-'))
const {createApi}=require('../server/api.cjs'),{createSession}=require('../server/security.cjs')
test('packaged API authorization, cross-site rejection, import limits and path boundary',async()=>{
 const session=createSession(),server=http.createServer(createApi({authorize:session.authorize}))
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 const headers={'x-onlysubs-session':session.token,'Content-Type':'application/json'}
 try{
  assert.equal((await fetch(url+'/settings')).status,401)
  assert.equal((await fetch(url+'/settings',{headers})).status,200)
  assert.equal((await fetch(url+'/settings',{headers:{...headers,Origin:'https://evil.example'}})).status,403)
  assert.equal((await fetch(url+'/settings',{headers:{...headers,'Sec-Fetch-Site':'cross-site'}})).status,403)
  assert.equal((await fetch(url+'/import',{method:'POST',headers:{...headers,'x-filename':'test.exe'},body:'x'})).status,400)
  const imports=path.join(process.env.REEL_DATA_ROOT,'work/imports');await fs.mkdir(imports,{recursive:true})
  const outside=path.join(process.env.REEL_DATA_ROOT,'outside.mp4');await fs.writeFile(outside,'private')
  const result=await fetch(url+'/metadata',{method:'POST',headers,body:JSON.stringify({video:outside})})
  assert.equal(result.status,500);assert.match((await result.json()).error,/imported video/)
  await fs.symlink(path.dirname(outside),path.join(imports,'link'),'junction')
  const linked=await fetch(url+'/media?file='+encodeURIComponent(path.join(imports,'link/outside.mp4')),{headers})
  assert.equal(linked.status,500)
  await fs.unlink(path.join(imports,'link'))
  const large=await new Promise((resolve,reject)=>{const req=http.request(url+'/import',{method:'POST',headers:{...headers,'Content-Length':9*1024**3}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end()})
  assert.equal(large,413)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})
