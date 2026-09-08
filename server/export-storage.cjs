const fs=require('fs/promises'),path=require('path')
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
async function stat(file){try{return await fs.lstat(file)}catch(e){if(e.code==='ENOENT')return null;throw e}}
async function validatedFolder(job){
  const folder=job.result?.folder
  if(job.type!=='export'||job.status!=='complete'||!folder||!path.isAbsolute(folder)||!/^export-\d+-[a-f0-9]+$/i.test(path.basename(folder)))throw new Error('Only completed, app-generated exports can be deleted.')
  const info=await stat(folder)
  if(!info)return null
  if(!info.isDirectory()||info.isSymbolicLink()||!same(await fs.realpath(folder),folder))throw new Error('Export folder links are not allowed for deletion.')
  return folder
}
async function validatedFile(folder,file){
  if(!file||!path.isAbsolute(file)||!same(path.dirname(file),folder))throw new Error('File is outside its generated export folder.')
  const info=await stat(file)
  if(info&&(!info.isFile()||info.isSymbolicLink()||!same(await fs.realpath(file),file)))throw new Error('Only regular generated files can be deleted.')
  return info
}
async function listFiles(job){
  if(job.type!=='export'||job.status!=='complete')return []
  const folder=await validatedFolder(job),result=[]
  for(const [index,file] of (job.result?.files||[]).entries()){
    if(file.deletedAt)continue
    const info=folder?await validatedFile(folder,file.path):null
    result.push({jobId:job.id,index,name:file.name||path.basename(file.path),size:info?.size||0,missing:!info,duration:file.duration,folder:job.result.folder})
  }
  return result
}
async function deleteFile(job,index,save){
  if(!Number.isInteger(index)||index<0||!job.result?.files?.[index])throw new Error('Invalid export file index.')
  const file=job.result.files[index]
  if(file.deletedAt)return {deleted:true,freedBytes:0,result:job.result}
  const folder=await validatedFolder(job)
  if(same(file.path,job.video||'.'))throw new Error('The source video cannot be deleted here.')
  const info=folder?await validatedFile(folder,file.path):null
  if(path.extname(file.path).toLowerCase()!=='.mp4')throw new Error('Only generated MP4 exports can be deleted here.')
  const subtitles=[]
  if(folder){
    // Exact renderer-created subtitle names only; never recursively delete a folder.
    const names=job.result.combined?(await fs.readdir(folder)).filter(n=>/^captions-\d+\.ass$/.test(n)):[`captions-${index+1}.ass`,path.basename(file.path,'.mp4')+'.ass']
    for(const name of new Set(names)){
      const target=path.join(folder,name),details=await validatedFile(folder,target)
      if(details)subtitles.push({target,size:details.size})
    }
  }
  if(info)await fs.unlink(file.path)
  // Tombstones preserve stable download indexes and prevent stale editor snapshots restoring files.
  file.deletedAt=Date.now();await save(job)
  let freedBytes=info?.size||0;const warnings=[]
  for(const item of subtitles){try{await fs.unlink(item.target);freedBytes+=item.size}catch(e){warnings.push('Could not remove subtitle helper: '+e.code)}}
  if(folder)try{await fs.rmdir(folder)}catch(e){if(!['ENOTEMPTY','EEXIST','ENOENT'].includes(e.code))warnings.push('Could not remove empty export folder: '+e.code)}
  return {deleted:true,freedBytes,warnings,result:job.result}
}
module.exports={listFiles,deleteFile}
