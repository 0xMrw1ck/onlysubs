const path = require('path')
const fs = require('fs/promises')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')
const { randomUUID } = require('crypto')
const root = process.env.REEL_DATA_ROOT || path.resolve(__dirname,'..')
const workDir = path.join(root,'work'), outputDir = path.join(root,'outputs')
const engineDir=process.env.ONLYSUBS_ENGINE_DIR
const bundledTranscriber=engineDir&&path.join(engineDir,'onlysubs-transcriber','onlysubs-transcriber.exe')
const defaults = {ffmpegPath:engineDir?path.join(engineDir,'ffmpeg.exe'):'ffmpeg',ffprobePath:engineDir?path.join(engineDir,'ffprobe.exe'):'ffprobe',pythonPath:'python',transcriberPath:bundledTranscriber||'',transcriptionModel:'small',ollamaUrl:'http://127.0.0.1:11434',model:'qwen3:8b',outputFolder:outputDir}
const safeName=s=>String(s||'video').replace(/[^a-z0-9._-]/gi,'-').slice(0,65)
function run(bin,args,{cwd,onProgress}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{windowsHide:true,cwd});let err='',out='',buffer=''
    child.stderr.on('data',d=>{err=(err+d).slice(-4000)})
    child.stdout.on('data',d=>{
      out=(out+d).slice(-1000000);buffer+=d
      const lines=buffer.split(/\r?\n/);buffer=lines.pop().slice(-65536)
      for(const line of lines){const match=line.match(/^out_time_us=(\d+)/);if(match)onProgress?.(Number(match[1])/1e6)}
    })
    child.on('error',e=>reject(new Error(bin+': '+e.message)))
    child.on('close',code=>code===0?resolve(out):reject(new Error(bin+' failed: '+err.slice(-1600))))
  })
}
async function getSettings(){
  let next={...defaults}
  try{const saved=JSON.parse(await fs.readFile(path.join(workDir,'settings.json'),'utf8'));delete saved.whisperxPath;next={...next,...saved}}catch{}
  if(engineDir)Object.assign(next,{ffmpegPath:path.join(engineDir,'ffmpeg.exe'),ffprobePath:path.join(engineDir,'ffprobe.exe'),pythonPath:'Included with onlysubs',transcriberPath:bundledTranscriber})
  return next
}
async function saveSettings(s){await fs.mkdir(workDir,{recursive:true});const next=Object.fromEntries(Object.keys(defaults).map(k=>[k,s[k]??defaults[k]]));await fs.writeFile(path.join(workDir,'settings.json'),JSON.stringify(next,null,2));return getSettings()}
async function health(){const s=await getSettings(),embedded=!!s.transcriberPath;const [ffmpeg,transcriber]=await Promise.all([run(s.ffmpegPath,['-version']).then(()=>true,()=>false),embedded?run(s.transcriberPath,['--health']).then(()=>true,()=>false):run(s.pythonPath,['-c','import faster_whisper']).then(()=>true,()=>false)]);return {ffmpeg,transcriber,embedded,ready:ffmpeg&&transcriber}}
async function probe(video){
  const s=await getSettings(),data=JSON.parse(await run(s.ffprobePath,['-protocol_whitelist','file,pipe','-v','error','-show_format','-show_streams','-of','json',video]))
  const stream=data.streams.find(s=>s.codec_type==='video');if(!stream)throw new Error('No video stream found.')
  const rotated=Math.abs(Number(stream.side_data_list?.find(x=>x.rotation!==undefined)?.rotation)||0)%180===90
  return {duration:Number(data.format.duration||stream.duration),width:rotated?stream.height:stream.width,height:rotated?stream.width:stream.height,frameRate:stream.avg_frame_rate,hasAudio:data.streams.some(s=>s.codec_type==='audio'),colorTransfer:stream.color_transfer,colorPrimaries:stream.color_primaries,colorSpace:stream.color_space,colorRange:stream.color_range}
}
async function analyse({jobId,video,onStage=async()=>{}}){
  const s=await getSettings(),temp=path.join(workDir,'jobs',jobId);await fs.mkdir(temp,{recursive:true})
  const metadata=await probe(video),audio=path.join(temp,'audio.wav'),transcriptFile=path.join(temp,'transcript.json')
  await onStage(12,'Extracting audio');await run(s.ffmpegPath,['-y','-protocol_whitelist','file,pipe','-i',video,'-vn','-ac','1','-ar','16000',audio])
  await onStage(38,'Transcribing and aligning words. This stage can take several minutes.')
  const script=path.join(__dirname,'transcribe.py').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep),cache=path.join(root,'models')
  if(s.transcriberPath)await run(s.transcriberPath,[audio,transcriptFile,'--model',s.transcriptionModel,'--cache-dir',cache])
  else await run(s.pythonPath,[script,audio,transcriptFile,'--model',s.transcriptionModel,'--cache-dir',cache])
  const raw=JSON.parse(await fs.readFile(transcriptFile,'utf8')),segments=raw.segments.map(x=>({...x,text:x.text.trim()}))
  await onStage(76,'Finding clip suggestions');let clips=[],warning=''
  try{
    const url=new URL(s.ollamaUrl);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Use a local Ollama server.')
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use a local HTTP Ollama server.')
    const response=await fetch(new URL('/api/generate',url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/json'},body:JSON.stringify({model:s.model,stream:false,format:'json',prompt:'Return JSON object {"clips": [{"start": number,"end": number,"title": string,"reason": string}]}. Pick up to 8 non-overlapping 20-60 second moments using exact transcript seconds. Transcript: '+JSON.stringify(segments.map(({start,end,text})=>({start,end,text})))})})
    if(!response.ok)throw new Error('Ollama unavailable')
    const parsed=JSON.parse((await response.json()).response);clips=(parsed.clips||parsed).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start&&c.end<=metadata.duration)
  }catch{
    warning='Local language model unavailable. Suggestions are transcript-based; review the cuts.'
    for(let i=0;i<segments.length&&clips.length<8;){const start=segments[i].start;let j=i;while(j+1<segments.length&&segments[j].end-start<30)j++;clips.push({start,end:segments[j].end,title:segments[i].text.slice(0,65),reason:'Transcript-based suggestion'});i=j+1}
  }
  await onStage(95,'Saving transcript and suggestions')
  return {transcript:segments,clips:clips.map((c,i)=>({...c,id:'clip-'+i,selected:true})),metadata,warning}
}
async function exportClips({video,clips=[],transcript=[],fullVideo=false,combine=false,quality='high',layout='original',outputFolder:onDemandFolder,onProgress=()=>{},...options}){
  const s=await getSettings(),metadata=await probe(video)
  const {exportRanges,outputDimensions,exportQualities}=await import(pathToFileURL(path.join(__dirname,'../shared/exports.mjs')).href)
  const selected=exportRanges(clips,metadata.duration,{fullVideo,combine}),encoding=exportQualities[quality]
  if(!encoding)throw new Error('Choose a supported export quality.')
  if(['smpte2084','arib-std-b67'].includes(metadata.colorTransfer))throw new Error('This source is HDR. Export currently supports SDR video; use an SDR copy to avoid washed-out colours.')
  const destination=path.resolve(onDemandFolder||s.outputFolder||outputDir)
  await fs.mkdir(destination,{recursive:true})
  await fs.access(destination)
  const folder=path.join(destination,'export-'+Date.now()+'-'+randomUUID().slice(0,8));await fs.mkdir(folder,{recursive:true})
  const {makeAss}=await import(pathToFileURL(path.join(__dirname,'../shared/captions.mjs')).href)
  const {width,height}=outputDimensions(metadata,layout),joining=combine&&selected.length>1
  const total=selected.reduce((sum,c)=>sum+c.end-c.start,0),files=[],parts=[]
  const colorArgs=[]
  for(const [flag,value] of [['-color_trc',metadata.colorTransfer],['-color_primaries',metadata.colorPrimaries],['-colorspace',metadata.colorSpace],['-color_range',metadata.colorRange]])if(value&&value!=='unknown'&&value!=='unspecified')colorArgs.push(flag,value)
  let completed=0
  for(let i=0;i<selected.length;i++){
    const c=selected[i],end=c.end,duration=end-c.start,base=combine?'Combined-checked-clips':(i+1)+'-'+safeName(c.title),assName='captions-'+(i+1)+'.ass',filename=joining?'part-'+(i+1)+'.mkv':base+'.mp4'
    await fs.writeFile(path.join(folder,assName),makeAss(transcript,c.start,end,width,height,options))
    const sizing=layout!=='original'?'scale='+width+':'+height+':force_original_aspect_ratio=increase:flags=lanczos,crop='+width+':'+height+',setsar=1':'pad='+width+':'+height+':0:0'
    const vf='setpts=PTS-STARTPTS,'+sizing+',subtitles='+assName
    const detail='Rendering '+(i+1)+' of '+selected.length+' · '+encoding.label.split(' · ')[0]
    onProgress(completed/total*(joining?94:99),detail)
    // PCM intermediates avoid adding AAC encoder delay at each cut. Video is encoded only once.
    const audio=joining?['-c:a','pcm_s16le']:['-c:a','aac','-b:a','320k']
    await run(s.ffmpegPath,['-y','-ss',String(c.start),'-protocol_whitelist','file,pipe','-i',video,'-t',String(duration),'-map','0:v:0','-map','0:a:0?','-vf',vf,'-c:v','libx264','-preset',encoding.preset,'-crf',String(encoding.crf),'-pix_fmt','yuv420p','-fps_mode','passthrough',...colorArgs,...audio,...(joining?[]:['-movflags','+faststart']),'-progress','pipe:1','-nostats',filename],{cwd:folder,onProgress:seconds=>onProgress(Math.min(99,(completed+Math.min(duration,seconds))/total*(joining?94:99)),detail)})
    completed+=duration
    if(joining)parts.push({filename,duration})
    else files.push({name:filename,path:path.join(folder,filename),duration})
  }
  if(joining){
    const filename='Combined-checked-clips.mp4'
    // Only generated, relative filenames enter the manifest; no user paths or shell interpolation.
    await fs.writeFile(path.join(folder,'join.ffconcat'),'ffconcat version 1.0\n'+parts.map(p=>`file '${p.filename}'\nduration ${p.duration}\n`).join(''))
    onProgress(94,'Joining selections into one MP4')
    await run(s.ffmpegPath,['-y','-f','concat','-safe','1','-protocol_whitelist','file,pipe','-i','join.ffconcat','-map','0:v:0','-map','0:a:0?','-c:v','copy','-c:a','aac','-b:a','320k','-t',String(total),'-movflags','+faststart','-progress','pipe:1','-nostats',filename],{cwd:folder,onProgress:seconds=>onProgress(Math.min(99,94+seconds/total*5),'Joining selections into one MP4')})
    files.push({name:filename,path:path.join(folder,filename),duration:total})
    // Remove only the scratch files created by this export, after the final MP4 succeeds.
    await Promise.all(parts.map(p=>fs.unlink(path.join(folder,p.filename))))
    await fs.unlink(path.join(folder,'join.ffconcat'))
  }
  return {folder,files,width,height,quality,combined:combine,ranges:selected.map(({start,end})=>({start,end}))}
}
module.exports={root,workDir,outputDir,getSettings,saveSettings,health,probe,analyse,exportClips,run}
