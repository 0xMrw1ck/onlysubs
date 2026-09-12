const fs=require('fs/promises')
const nativeFs=require('fs')
const path=require('path')
const {randomUUID}=require('crypto')
const {pipeline:pipe}=require('stream/promises')
const {Transform}=require('stream')
const engine=require('./local-pipeline.cjs')
const exportStorage=require('./export-storage.cjs')
const jobRoot=path.join(engine.workDir,'jobs')
const validId=id=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new Error('Invalid job ID');return id}
async function atomic(file,data){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(data));await fs.rename(tmp,file)}
const readJob=async id=>JSON.parse(await fs.readFile(path.join(jobRoot,validId(id),'status.json'),'utf8'))
async function latest(){try{const saved=JSON.parse(await fs.readFile(path.join(jobRoot,'latest.json'),'utf8'));return readJob(saved.id)}catch{return null}}
async function serveFile(req,res,file,download=false){
  const link=await fs.lstat(file),real=await fs.realpath(file)
  const normalize=p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p)
  if(!link.isFile()||link.isSymbolicLink()||normalize(real)!==normalize(file))throw new Error('Linked media paths are not allowed.')
  const stat=await fs.stat(file),size=stat.size
  const range=req.headers.range;let start=0,end=size-1,status=200
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end()}
    if(!match[1])start=Math.max(0,size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}
    if(start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end()}status=206
  }
  const mime={'.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm'}[path.extname(file).toLowerCase()]||'application/octet-stream'
  const headers={'Content-Type':mime,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store'}
  if(status===206)headers['Content-Range']='bytes '+start+'-'+end+'/'+size
  if(download)headers['Content-Disposition']='attachment; filename="'+path.basename(file).replace(/[^a-z0-9._-]/gi,'-')+'"'
  res.writeHead(status,headers);if(req.method==='HEAD')return res.end()
  const stream=nativeFs.createReadStream(file,{start,end});res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res)
}
async function importedVideo(file){
 const folder=await fs.realpath(path.join(engine.workDir,'imports'))
 const resolved=await fs.realpath(path.resolve(String(file||'')))
 if(path.dirname(resolved).toLowerCase()!==folder.toLowerCase())throw new Error('Choose an imported video.')
 if(!(await fs.stat(resolved)).isFile())throw new Error('Invalid video file.')
 return resolved
}
function createApi({authorize}={}){
  const active=new Map(),writes=new Map(),deletions=new Map()
  const save=job=>{const snapshot=JSON.parse(JSON.stringify(job));const next=(writes.get(job.id)||Promise.resolve()).catch(()=>{}).then(()=>atomic(path.join(jobRoot,validId(job.id),'status.json'),snapshot));writes.set(job.id,next);return next}
  const status=async id=>{const job=active.get(id)||await readJob(id);if(job.status==='processing'&&!active.has(id))return {...job,status:'interrupted',detail:'Server restarted. Your saved edits are safe; start processing again.'};return job}
  const reply=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  const read=async req=>{let bytes=0,parts=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>30*1024*1024)throw new Error('Request too large');parts.push(chunk)}return JSON.parse(Buffer.concat(parts).toString()||'{}')}
  return async(req,res)=>{
    try{
      if(authorize&&!authorize(req))return reply(res,401,{error:'This desktop session is not authorized.'})
      const host=(req.headers.host||'').split(':')[0];if(!['localhost','127.0.0.1'].includes(host))return reply(res,403,{error:'Local access only'})
      if(req.headers['sec-fetch-site']==='cross-site')return reply(res,403,{error:'Cross-site access denied'})
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'Same-origin access required'})
      const u=new URL(req.url,'http://localhost'),p=u.pathname
      if(req.method==='GET'&&p==='/settings')return reply(res,200,await engine.getSettings())
      if(req.method==='GET'&&p==='/health')return reply(res,200,await engine.health())
      if(req.method==='GET'&&p==='/exports'){
        const files=[],warnings=[]
        const entries=await fs.readdir(jobRoot,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e})
        for(const entry of entries){if(!entry.isDirectory()||entry.isSymbolicLink())continue
          try{files.push(...await exportStorage.listFiles(await readJob(entry.name)))}catch(error){if(error.code!=='ENOENT')warnings.push('Could not inspect export '+entry.name)}
        }
        return reply(res,200,{files,warnings,totalBytes:files.reduce((n,f)=>n+f.size,0)})
      }
      if(req.method==='DELETE'&&p.startsWith('/exports/')){
        const segments=p.split('/'),id=validId(segments[2]),index=Number(segments[3]),data=await read(req)
        if(segments.length!==4||!/^\d+$/.test(segments[3])||data.confirm!==true)return reply(res,400,{error:'Explicit deletion confirmation and file index required.'})
        if(active.has(id))return reply(res,409,{error:'Wait for this export to finish.'})
        const operation=(deletions.get(id)||Promise.resolve()).catch(()=>{}).then(async()=>exportStorage.deleteFile(await readJob(id),index,save))
        deletions.set(id,operation)
        try{return reply(res,200,await operation)}finally{if(deletions.get(id)===operation)deletions.delete(id)}
      }
      if(req.method==='GET'&&p==='/jobs/latest'){const job=await latest();return reply(res,200,job?await status(job.id):null)}
      if(req.method==='GET'&&p==='/editor/latest'){try{const {id}=JSON.parse(await fs.readFile(path.join(jobRoot,'editor-latest.json'),'utf8'));return reply(res,200,JSON.parse(await fs.readFile(path.join(jobRoot,validId(id),'editor.json'),'utf8')))}catch{return reply(res,200,null)}}
      if(req.method==='GET'&&p.startsWith('/jobs/'))return reply(res,200,await status(p.split('/').pop()))
      if(['GET','HEAD'].includes(req.method)&&p==='/media'){
        const file=await importedVideo(u.searchParams.get('file'))
        return await serveFile(req,res,file)
      }
      if(['GET','HEAD'].includes(req.method)&&p==='/download'){
        const job=await readJob(u.searchParams.get('job')),index=Number(u.searchParams.get('index')),file=job.result?.files?.[index]
        if(!file)throw new Error('Export not found');if(file.deletedAt)return reply(res,410,{error:'This generated export was deleted.'});return await serveFile(req,res,file.path,u.searchParams.get('save')==='1')
      }
      if(req.method==='GET'&&p.startsWith('/editor/')){try{return reply(res,200,JSON.parse(await fs.readFile(path.join(jobRoot,validId(p.split('/').pop()),'editor.json'),'utf8')))}catch{return reply(res,200,null)}}
      if(req.method==='POST'&&p==='/import'){
        const limit=8*1024**3
        if(Number(req.headers['content-length'])>limit)return reply(res,413,{error:'Video exceeds the 8 GB import limit.'})
        const name=decodeURIComponent(req.headers['x-filename']||'video.mp4').replace(/[^a-z0-9._-]/gi,'-').slice(-100),folder=path.join(engine.workDir,'imports');await fs.mkdir(folder,{recursive:true})
        if(!/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(name))return reply(res,400,{error:'Choose an MP4, MOV, MKV, WebM, AVI, or M4V video.'})
        const disk=await fs.statfs(folder),required=Number(req.headers['content-length'])||limit
        if(disk.bavail*disk.bsize<required+512*1024**2)return reply(res,507,{error:'Not enough free space to import safely.'})
        const video=path.join(folder,randomUUID()+'-'+name);let size=0
        const bounded=new Transform({transform(chunk,_encoding,done){size+=chunk.length;done(size>limit?new Error('Video exceeds the 8 GB limit'):null,chunk)}})
        try{await pipe(req,bounded,nativeFs.createWriteStream(video,{flags:'wx'}));return reply(res,200,{video,metadata:await engine.probe(video)})}catch(error){await fs.unlink(video).catch(()=>{});throw error}
      }
      if(req.method==='POST'&&p==='/metadata'){const {video}=await read(req);return reply(res,200,await engine.probe(await importedVideo(video)))}
      if(req.method==='POST'&&p==='/settings')return reply(res,200,await engine.saveSettings(await read(req)))
      if(req.method==='PUT'&&p.startsWith('/editor/')){const id=validId(p.split('/').pop());await atomic(path.join(jobRoot,id,'editor.json'),await read(req));await atomic(path.join(jobRoot,'editor-latest.json'),{id});return reply(res,200,{saved:true})}
      if(req.method==='POST'&&(p==='/analyse'||p==='/export')){
        const data=await read(req),id=p==='/analyse'?validId(data.jobId):randomUUID(),job={id,video:data.video,type:p.slice(1),status:'processing',percent:0,detail:'Queued locally'}
        data.video=await importedVideo(data.video)
        if(active.size)return reply(res,409,{error:'Wait for the current processing job to finish.'})
        if(active.has(id))return reply(res,409,{error:'Job already running'})
        active.set(id,job);await save(job)
        if(p==='/analyse')await atomic(path.join(jobRoot,'latest.json'),{id})
        const progress=async(percent,detail)=>{Object.assign(job,{percent:Math.floor(percent),detail});await save(job)}
        const operation=p==='/analyse'?engine.analyse({...data,onStage:progress}):engine.exportClips({...data,onProgress:(percent,detail)=>{Object.assign(job,{percent:Math.floor(percent),detail})}})
        operation.then(async result=>{Object.assign(job,{status:'complete',percent:100,detail:p==='/analyse'?'Ready to edit':'Export complete',result});await save(job)}).catch(async error=>{Object.assign(job,{status:'failed',detail:error.message,error:error.message});await save(job)}).finally(()=>active.delete(id))
        return reply(res,202,job)
      }
      return reply(res,404,{error:'Unknown local API route'})
    }catch(error){if(!res.headersSent)reply(res,500,{error:error.message});else res.destroy()}
  }
}
module.exports={createApi,serveFile}
