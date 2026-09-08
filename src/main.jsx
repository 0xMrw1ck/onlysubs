import React, {useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {captionCues,captionStyle,captionLines,presets} from '../shared/captions.mjs'
import {exportQualities,exportRanges,outputDimensions} from '../shared/exports.mjs'
import './style.css'
import {Trust,Modal} from './Trust'
import {subtitleText} from '../shared/subtitles.mjs'

const time=s=>{const n=Math.max(0,Number(s)||0);return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')}
const bytes=n=>n>=1024**3?(n/1024**3).toFixed(2)+' GB':n>=1024**2?(n/1024**2).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B'
const api=async(url,data,method)=>{const response=await fetch('/api'+url,{method:method||(data?'POST':'GET'),headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined});const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result}
const blank={id:null,video:null,metadata:null,transcript:[],clips:[],quickSelected:[],captionPreset:'clean',captionScale:1,captionBottom:12,layout:'original',quality:'high',exports:[]}
function localDraft(){try{return localStorage.getItem('onlysubs-backup')==='yes'?JSON.parse(localStorage.getItem('reel-editor-v2')||'null'):null}catch{return null}}
function App(){
 const [remember,setRemember]=useState(()=>{try{return localStorage.getItem('onlysubs-backup')==='yes'}catch{return false}}),[showCaptions,setShowCaptions]=useState(true)
 function changeRemember(value){setRemember(value);try{localStorage.setItem('onlysubs-backup',value?'yes':'no');if(!value)localStorage.removeItem('reel-editor-v2')}catch{}}
 const [storage,setStorage]=useState(null),[storageOpen,setStorageOpen]=useState(false),[storageBusy,setStorageBusy]=useState(false),[storageSelected,setStorageSelected]=useState([]),[deleteRequest,setDeleteRequest]=useState(null),[deleting,setDeleting]=useState(false)
 const [editor,setEditor]=useState(blank),[ready,setReady]=useState(false),[job,setJob]=useState(null),[exportJob,setExportJob]=useState(null),[health,setHealth]=useState(null),[settings,setSettings]=useState(null),[showSettings,setShowSettings]=useState(false),[notice,setNotice]=useState('Choose a video to begin.'),[tab,setTab]=useState('transcript'),[range,setRange]=useState(null),[current,setCurrent]=useState(0),[customStart,setCustomStart]=useState(0),[customEnd,setCustomEnd]=useState(10),[uploading,setUploading]=useState(false),[pending,setPending]=useState(false),[search,setSearch]=useState(''),[saveLabel,setSaveLabel]=useState('Saved on this PC')
 const videoRef=useRef(null),fileRef=useRef(null),saveQueue=useRef(Promise.resolve()),mounted=useRef(true)
 const busy=pending||uploading||deleting||job?.status==='processing'||exportJob?.status==='processing'
 const update=patch=>setEditor(e=>({...e,...patch}))
 const duration=editor.metadata?.duration||0
 const dimensions=outputDimensions(editor.metadata,editor.layout)
 const cues=useMemo(()=>captionCues(editor.transcript),[editor.transcript])
 const subtitleUrls=useMemo(()=>Object.fromEntries(['vtt','srt'].map(format=>[format,URL.createObjectURL(new Blob([subtitleText(editor.transcript,format)],{type:'text/'+(format==='vtt'?'vtt':'plain')+';charset=utf-8'}))])),[editor.transcript])
 useEffect(()=>()=>Object.values(subtitleUrls).forEach(URL.revokeObjectURL),[subtitleUrls])
 const cue=cues.find(c=>current>=c.start&&current<c.end)
 const style=captionStyle(editor.captionPreset,dimensions.width,dimensions.height,editor.captionScale,editor.captionBottom)
 const quickCuts=useMemo(()=>Array.from({length:Math.ceil(duration/10)},(_,i)=>({id:'manual-'+i,start:i*10,end:Math.min(duration,(i+1)*10),title:'Manual-'+(i+1),selected:editor.quickSelected.includes(i)})),[duration,editor.quickSelected])
 const progressJob=exportJob?.status==='processing'?exportJob:job?.status==='processing'?job:null
 const acceptResult=(saved)=>{
   setEditor(e=>({...e,id:saved.id,video:saved.video,metadata:saved.result.metadata||e.metadata,transcript:saved.result.transcript||[],clips:(saved.result.clips||[]).map(c=>({...c,selected:true})),quickSelected:[]}))
   setNotice(saved.result.warning||'Processing complete. Edit your captions and choose an export.')
 }
 useEffect(()=>{
   mounted.current=true
   async function load(){
     let draft=localDraft()
     try{
       const diskDraft=await api('/editor/latest')
       if(diskDraft&&(!draft||diskDraft.updatedAt>draft.updatedAt))draft=diskDraft
       const latest=await api('/jobs/latest')
       let restored=draft
       if(latest && (!draft||draft.id===latest.id)){
         const disk=await api('/editor/'+latest.id)
         const saved=disk&&(!draft||disk.updatedAt>draft.updatedAt)?disk:draft
         if(saved)restored=saved
         else if(latest.result)restored={...blank,id:latest.id,video:latest.video,transcript:latest.result.transcript,clips:latest.result.clips.map(c=>({...c,selected:true})),metadata:latest.result.metadata}
         else restored={...blank,id:latest.id,video:latest.video}
         if(mounted.current)setJob(latest)
       }
       if(restored?.video){
         if(!restored.metadata)restored.metadata=await api('/metadata',{video:restored.video})
         if(restored.exportJobId){
           const exp=await api('/jobs/'+restored.exportJobId)
           if(exp.status==='complete'&&!restored.exports?.some(x=>x.jobId===exp.id))restored.exports=[{jobId:exp.id,...exp.result},...(restored.exports||[])]
           if(mounted.current)setExportJob(exp)
         }
         // Server tombstones are authoritative, even if an old browser/disk editor copy lists the file.
         restored.exports=await Promise.all((restored.exports||[]).map(async batch=>{try{const saved=await api('/jobs/'+batch.jobId);return saved.result?{jobId:batch.jobId,...saved.result}:batch}catch{return batch}}))
         if(mounted.current){setEditor({...blank,...restored});setNotice('Restored your saved project and selections.')}
       }
     }catch(e){if(draft&&mounted.current)setEditor({...blank,...draft});if(mounted.current)setNotice('Could not reconnect: '+e.message)}
     if(mounted.current)setReady(true)
   }
   load();api('/health').then(v=>mounted.current&&setHealth(v)).catch(()=>{});api('/settings').then(v=>mounted.current&&setSettings(v)).catch(()=>{})
   return()=>{mounted.current=false}
 },[])
 // Poll only an active job. A terminal result is applied once, then polling stops.
 useEffect(()=>{
   if(job?.status!=='processing')return
   let stopped=false,timer
   const poll=async()=>{try{const next=await api('/jobs/'+job.id);if(stopped)return;setJob(next);if(next.status==='complete')acceptResult(next);else if(next.status!=='processing')setNotice(next.detail)}catch{if(!stopped)setNotice('Connection interrupted. Reconnecting to the saved job…')}
     if(!stopped)timer=setTimeout(poll,1500)}
   timer=setTimeout(poll,500);return()=>{stopped=true;clearTimeout(timer)}
 },[job?.id,job?.status])
 useEffect(()=>{
   if(exportJob?.status!=='processing')return
   let stopped=false,timer
   const poll=async()=>{try{const next=await api('/jobs/'+exportJob.id);if(stopped)return;setExportJob(next);if(next.status==='complete'){
     setEditor(e=>({...e,exports:[{jobId:next.id,...next.result},...e.exports].slice(0,12)}));setNotice('Export complete. Play or download the MP4 below the preview.')
   }else if(next.status!=='processing')setNotice(next.detail)
   }catch{if(!stopped)setNotice('Reconnecting to export…')}
   if(!stopped)timer=setTimeout(poll,1200)}
   timer=setTimeout(poll,400);return()=>{stopped=true;clearTimeout(timer)}
 },[exportJob?.id,exportJob?.status])
 useEffect(()=>{
   if(!ready||!editor.video)return
   const snapshot={...editor,updatedAt:Date.now()}
   try{if(remember)localStorage.setItem('reel-editor-v2',JSON.stringify(snapshot));else localStorage.removeItem('reel-editor-v2')}catch{setSaveLabel('Browser storage unavailable')}
   if(!editor.id)return
   setSaveLabel('Saving edits…')
   const timer=setTimeout(()=>{saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>api('/editor/'+editor.id,snapshot,'PUT')).then(()=>setSaveLabel('Saved on this PC')).catch(()=>setSaveLabel(remember?'Browser backup only; server disconnected':'Not saved — server disconnected'))},450)
   return()=>clearTimeout(timer)
 },[editor,ready,remember])
 async function upload(event){
   const file=event.target.files?.[0];if(!file)return
   setUploading(true);setNotice('Importing video locally…')
   try{const response=await fetch('/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent(file.name)},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error)
     setEditor({...blank,id:crypto.randomUUID(),video:data.video,metadata:data.metadata});setJob(null);setExportJob(null);setRange(null);setCurrent(0);setNotice('Video loaded. You can cut or export now, or transcribe for captions.')
   }catch(e){setNotice('Import failed: '+e.message)}finally{setUploading(false);event.target.value=''}
 }
 async function analyse(){
   setPending(true);setNotice('Starting local transcription…')
   try{const queued=await api('/analyse',{jobId:crypto.randomUUID(),video:editor.video});setJob(queued);update({id:queued.id})}catch(e){setNotice(e.message)}finally{setPending(false)}
 }
 async function exportVideo(mode){
   const clips=mode.startsWith('manual')?quickCuts:mode==='range'?[{start:Number(customStart),end:Number(customEnd),title:'Custom-cut',selected:true}]:mode==='sample'?[{start:range?.start??current,end:Math.min(duration,(range?.start??current)+8),title:'Caption-preview',selected:true}]:editor.clips
   setPending(true);setNotice('Preparing export…')
   try{const exp=await api('/export',{video:editor.video,fullVideo:mode==='full',combine:mode.endsWith('-combined'),quality:editor.quality,clips,transcript:editor.transcript,layout:editor.layout,captionPreset:editor.captionPreset,captionScale:editor.captionScale,captionBottom:editor.captionBottom});setExportJob(exp);update({exportJobId:exp.id})}catch(e){setNotice(e.message)}finally{setPending(false)}
 }
 async function refreshStorage(){
   setStorageBusy(true)
   try{const data=await api('/exports');setStorage(data);setStorageSelected([]);return data}catch(e){setNotice('Cannot load export storage: '+e.message)}finally{setStorageBusy(false)}
 }
 async function openStorage(){setStorageOpen(true);await refreshStorage()}
 async function confirmDelete(){
   if(!deleteRequest?.length||deleting)return
   setDeleting(true);let freed=0,deleted=0;const errors=[]
   for(const item of deleteRequest){
     try{
       const result=await api('/exports/'+item.jobId+'/'+item.index,{confirm:true},'DELETE')
       freed+=result.freedBytes;deleted++
       setEditor(e=>({...e,exports:e.exports.map(batch=>batch.jobId===item.jobId?{jobId:item.jobId,...result.result}:batch)}))
       errors.push(...(result.warnings||[]))
     }catch(e){errors.push(item.name+': '+e.message)}
   }
   setDeleteRequest(null);setDeleting(false)
   setNotice(`${deleted} generated file${deleted===1?'':'s'} deleted permanently; ${bytes(freed)} removed. Source video and transcript kept.`+(errors.length?' '+errors.join(' · '):''))
   if(storageOpen)await refreshStorage()
 }
 function preview(start=0,end=duration){
   setRange({start,end});setCurrent(start)
   if(videoRef.current){videoRef.current.currentTime=start;videoRef.current.play().catch(()=>{})}
 }
 const toggleClip=i=>setEditor(e=>({...e,clips:e.clips.map((c,n)=>n===i?{...c,selected:!c.selected}:c)}))
 const editRow=(i,key,value)=>setEditor(e=>({...e,transcript:e.transcript.map((row,n)=>n===i?{...row,[key]:value}:row)}))
 const selectedCount=editor.clips.filter(c=>c.selected).length
 const combinedDuration=clips=>{try{return time(exportRanges(clips,duration,{combine:true}).reduce((n,c)=>n+c.end-c.start,0))}catch{return '0:00'}}
 const hasEstimates=cues.some(c=>c.estimated)
 return <main>
  <header><div className="brand"><img className="brand-logo" src="/onlysubs-logo.png" alt=""/><div><b>onlysubs</b><span className="brand-tagline">a clipping tool for everyone</span></div></div><span className="save-label">{saveLabel}</span><button onClick={openStorage}>Manage storage</button><button onClick={()=>setShowSettings(v=>!v)}>Settings</button></header>
  {storageOpen&&<section className="panel storage-panel" aria-label="Generated file storage"><div className="panel-tools"><h2>Generated files · {bytes(storage?.totalBytes||0)}</h2><div className="export-actions"><button disabled={storageBusy||deleting} onClick={refreshStorage}>Refresh files</button><button disabled={deleting} onClick={()=>setStorageOpen(false)}>Close storage</button></div></div><p className="hint">All tracked exports across projects, including rendered previews. Deleting permanently removes the generated MP4 and its subtitle helpers, not your source or transcript. Separate copies saved to your browser's Downloads folder must be deleted there manually.</p>{storageBusy?<p className="hint">Checking file sizes…</p>:<><div className="storage-list">{storage?.files.map(file=>{const key=file.jobId+':'+file.index;return <label className="storage-file" key={key}><input type="checkbox" aria-label={'Delete '+file.name+' from '+file.jobId} disabled={deleting} checked={storageSelected.includes(key)} onChange={e=>setStorageSelected(keys=>e.target.checked?[...keys,key]:keys.filter(k=>k!==key))}/><span>{file.name}<small>{file.folder}</small></span><b>{file.missing?'Already missing':bytes(file.size)}</b></label>})}{!storage?.files.length&&<p className="hint">No tracked generated videos to clean up.</p>}</div><div className="storage-actions"><button disabled={!storage?.files.length||deleting} onClick={()=>setStorageSelected(storage.files.map(f=>f.jobId+':'+f.index))}>Select all generated files</button><button className="danger" disabled={!storageSelected.length||busy} onClick={()=>setDeleteRequest(storage.files.filter(f=>storageSelected.includes(f.jobId+':'+f.index)))}>Delete selected ({storageSelected.length})</button></div>{storage?.warnings.length>0&&<p className="hint">Some export records could not be inspected and are excluded from deletion.</p>}</>}</section>}
  {deleteRequest&&<Modal title={'Permanently delete '+deleteRequest.length+' generated file(s)?'} onClose={deleting?undefined:()=>setDeleteRequest(null)}><p>This removes the selected MP4s and subtitle helpers from your drive. This does not use the Recycle Bin and cannot be undone. You can re-export from your saved source and transcript.</p><ul>{deleteRequest.slice(0,5).map(f=><li key={f.jobId+':'+f.index}>{f.name}</li>)}</ul>{deleteRequest.length>5&&<p>And {deleteRequest.length-5} more selected files.</p>}<p>Your source video, edits, and separate browser-downloaded copies will be kept.</p><div className="export-actions"><button autoFocus disabled={deleting} onClick={()=>setDeleteRequest(null)}>Cancel</button><button className="danger" disabled={deleting} onClick={confirmDelete}>{deleting?'Deleting…':'Permanently delete'}</button></div></Modal>}
  {showSettings&&<section className="settings panel"><h2>Local engines</h2>{settings&&Object.entries(settings).map(([key,value])=><label key={key}>{key}<input value={value} onChange={e=>setSettings({...settings,[key]:e.target.value})}/></label>)}<button onClick={async()=>{try{await api('/settings',settings);setHealth(await api('/health'));setShowSettings(false);setNotice('Settings saved.')}catch(e){setNotice(e.message)}}}>Save and check engines</button></section>}
  <div className="toolbar"><div><h1>{editor.video?editor.video.split(/[\\/]/).pop().replace(/^[a-f0-9-]{36}-/,''):'Turn your footage into a finished story.'}</h1><p>{duration?time(duration)+' source · ':''}Original video, short clips, and editable captions.</p></div><input hidden ref={fileRef} type="file" accept="video/*" onChange={upload}/><button disabled={busy} onClick={()=>fileRef.current.click()}>{editor.video?'Replace video':'Choose video'}</button><button disabled={!editor.video||busy} onClick={analyse}>{editor.transcript.length?'Re-transcribe with word timing':'Transcribe video'}</button><button className="primary" disabled={!editor.video||busy} onClick={()=>exportVideo('full')}>Export full video</button></div>
  {health&&!health.ready&&<div className="warning">Setup required: {!health.ffmpeg?'FFmpeg ':''}{!health.transcriber?'speech transcription ':''}unavailable. <button onClick={()=>setShowSettings(true)}>Open settings</button></div>}
  <div className="status" role="status">{progressJob?progressJob.detail:notice}{progressJob&&<div className="progress-row"><progress aria-label={progressJob.type==='export'?'Video rendering progress':'Processing stage progress'} max="100" value={progressJob.percent||0}/><b>{progressJob.percent||0}%</b><small>{progressJob.type==='export'?'Rendered duration':'Stage progress; transcription may take several minutes'}</small></div>}</div>
  <div className="editor-grid">
   <section className="edit-panel panel">
    <nav aria-label="Editor sections">{[['transcript','Transcript'],['clips','Suggested clips'],['cuts','Manual cuts']].map(([id,label])=><button key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}{id==='clips'?' · '+editor.clips.length:''}</button>)}</nav>
    {tab==='transcript'&&<><div className="panel-tools"><h2>Edit transcript</h2><input aria-label="Search transcript" placeholder="Find words…" value={search} onChange={e=>setSearch(e.target.value)}/></div><p className="hint">Edit the text or timing. Click a timestamp to play that moment.</p>{hasEstimates&&<p className="hint timing-note">This transcript contains estimated phrase timing. Re-transcribe for word alignment; text corrections use estimated timing within their row.</p>}
     <div className="rows">{editor.transcript.map((s,i)=>({s,i})).filter(({s})=>s.text.toLowerCase().includes(search.toLowerCase())).map(({s,i})=><div className={'transcript-row '+(current>=s.start&&current<s.end?'playing':'')} key={i}><button className="time" onClick={()=>preview(s.start,s.end)}>{time(s.start)}</button><div><textarea aria-label={'Transcript '+(i+1)} value={s.text} onChange={e=>editRow(i,'text',e.target.value)}/><div className="timing"><label>Start <input aria-label={'Segment '+(i+1)+' start'} type="number" min="0" step=".1" value={s.start} onChange={e=>editRow(i,'start',Number(e.target.value))}/></label><label>End <input aria-label={'Segment '+(i+1)+' end'} type="number" min="0" step=".1" value={s.end} onChange={e=>editRow(i,'end',Number(e.target.value))}/></label></div></div></div>)}
      {!editor.transcript.length&&<div className="empty"><h2>Your transcript appears here</h2><p>Transcribe for captions, or use Manual cuts to trim without transcription.</p></div>}
     </div></>}
    {tab==='clips'&&<><div className="panel-tools selection-tools"><h2>{selectedCount} checked · {combinedDuration(editor.clips)} combined</h2><div className="export-actions"><button disabled={!selectedCount||busy} onClick={()=>exportVideo('clips')}>Export separate clips</button><button disabled={!selectedCount||busy} className="primary" onClick={()=>exportVideo('clips-combined')}>Export checked as one video</button></div></div><p className="hint">Combined export follows timeline order. Touching or overlapping selections become one continuous cut; unchecked gaps are skipped.</p><div className="rows">{editor.clips.map((c,i)=><article className="clip-card" key={c.id||i}><input type="checkbox" aria-label={'Select clip '+(i+1)} checked={!!c.selected} onChange={()=>toggleClip(i)}/><div><input aria-label={'Clip '+(i+1)+' title'} className="clip-title" value={c.title||''} onChange={e=>setEditor(ed=>({...ed,clips:ed.clips.map((x,n)=>n===i?{...x,title:e.target.value}:x)}))}/><p>{time(c.start)} – {time(c.end)} · {c.reason||'Review this suggestion'}</p><button onClick={()=>preview(c.start,c.end)}>Preview clip</button></div></article>)}{!editor.clips.length&&<div className="empty">Transcribe the video to create suggestions.</div>}</div></>}
    {tab==='cuts'&&<div className="manual"><h2>Choose exactly what to keep</h2><p className="hint">Set a custom range or select independent 10-second pieces.</p><div className="range-fields"><label>Start (seconds)<input type="number" min="0" max={duration} step=".1" value={customStart} onChange={e=>setCustomStart(Number(e.target.value))}/></label><button onClick={()=>setCustomStart(Number(current.toFixed(1)))}>Use playhead</button><label>End (seconds)<input type="number" min="0" max={duration} step=".1" value={customEnd} onChange={e=>setCustomEnd(Number(e.target.value))}/></label><button onClick={()=>setCustomEnd(Number(current.toFixed(1)))}>Use playhead</button></div><div className="actions"><button disabled={customEnd<=customStart} onClick={()=>preview(customStart,customEnd)}>Preview range</button><button disabled={!duration||busy||customEnd<=customStart||customEnd>duration} onClick={()=>exportVideo('range')}>Export custom range</button></div><h2>10-second selections</h2><div className="cuts">{quickCuts.map((cut,i)=><label className={cut.selected?'cut selected':'cut'} key={cut.id}><input aria-label={'Select '+time(cut.start)+' to '+time(cut.end)} type="checkbox" checked={cut.selected} onChange={()=>update({quickSelected:cut.selected?editor.quickSelected.filter(x=>x!==i):[...editor.quickSelected,i]})}/>{time(cut.start)}–{time(cut.end)}<button aria-label={'Preview cut '+(i+1)} onClick={e=>{e.preventDefault();preview(cut.start,cut.end)}}>▶</button></label>)}</div><p className="hint">{editor.quickSelected.length} checked · {combinedDuration(quickCuts)} combined. Adjacent pieces play continuously; unchecked sections are skipped.</p><div className="export-actions"><button disabled={busy||!editor.quickSelected.length} onClick={()=>exportVideo('manual')}>Download separate cuts ({editor.quickSelected.length})</button><button className="primary" disabled={busy||!editor.quickSelected.length} onClick={()=>exportVideo('manual-combined')}>Export checked as one video</button></div></div>}
   </section>
   <aside className="preview-panel panel"><div className="panel-tools"><h2>Preview</h2><button disabled={!duration} onClick={()=>preview(0,duration)}>Play full video</button></div>
    <div className="preview-stage" style={{aspectRatio:dimensions.width+'/'+dimensions.height}}>
     {editor.video?<><video ref={videoRef} src={'/api/media?file='+encodeURIComponent(editor.video)} controls preload="metadata" onLoadedMetadata={e=>{const v=e.currentTarget;if(!editor.metadata&&Number.isFinite(v.duration))update({metadata:{duration:v.duration,width:v.videoWidth,height:v.videoHeight}})}} onTimeUpdate={e=>{const v=e.currentTarget;setCurrent(v.currentTime);if(range&&v.currentTime>=range.end){v.pause();setRange(null)}}} onError={()=>setNotice('This video cannot be previewed by the browser. Try an MP4 encoded with H.264.')}><track key={subtitleUrls.vtt} kind="captions" src={subtitleUrls.vtt} label="Edited transcript"/></video><svg viewBox={'0 0 '+dimensions.width+' '+dimensions.height} aria-hidden="true">{showCaptions&&cue&&captionLines(cue.text).map((line,i,lines)=><text key={i} x={dimensions.width/2} y={dimensions.height-style.margin-(lines.length-1-i)*style.fontSize*1.2} textAnchor="middle" fontFamily="Arial" fontSize={style.fontSize} fontWeight={style.weight} fill={style.color} stroke="#101010" strokeWidth={style.stroke*2} paintOrder="stroke">{line}</text>)}</svg></>:<div className="empty">Your video preview</div>}
    </div>
    <div className="scrubber"><span>{time(current)}</span><input aria-label="Video position" aria-valuetext={time(current)+' of '+time(duration)} type="range" min="0" max={duration||1} step=".05" value={current} onChange={e=>{const n=Number(e.target.value);setCurrent(n);setRange(null);if(videoRef.current)videoRef.current.currentTime=n}}/><span>{time(duration)}</span></div>
    <div className="preview-options"><label>Frame<select aria-label="Frame" value={editor.layout} onChange={e=>update({layout:e.target.value})}><option value="original">Original aspect ratio</option><option value="vertical">Vertical 9:16 · centre crop</option></select></label><label>Caption style<select aria-label="Caption style" value={editor.captionPreset} onChange={e=>update({captionPreset:e.target.value})}>{Object.entries(presets).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label><label>Text size · {Math.round(editor.captionScale*100)}%<input aria-label="Caption size" type="range" min=".6" max="1.6" step=".05" value={editor.captionScale} onChange={e=>update({captionScale:Number(e.target.value)})}/></label><label>Bottom spacing · {editor.captionBottom}%<input aria-label="Caption bottom spacing" type="range" min="5" max="35" value={editor.captionBottom} onChange={e=>update({captionBottom:Number(e.target.value)})}/></label></div>
    <div className="export-settings"><label>Export quality<select aria-label="Export quality" value={editor.quality} onChange={e=>update({quality:e.target.value})}>{Object.entries(exportQualities).map(([id,q])=><option key={id} value={id}>{q.label}</option>)}</select></label><span className="output-spec">{dimensions.width} × {dimensions.height} · MP4 / H.264 · source frame timing</span><p>Original framing keeps source resolution. Vertical crops never upscale. Captions require re-encoding; higher quality takes longer and uses more disk space.</p></div>
    <p className="hint">Short phrases, up to two lines. The overlay follows export timing and sizing. Render an 8-second sample to check the actual MP4.</p><button disabled={!duration||busy||current>=duration} onClick={()=>exportVideo('sample')}>Render preview sample</button>
    <section className="downloads"><h2>Finished videos</h2>{editor.exports.flatMap(batch=>batch.files.map((file,i)=>file.deletedAt?null:<details key={batch.jobId+'-'+i}><summary>{file.name} · {time(file.duration)}</summary><video controls preload="none" src={'/api/download?job='+batch.jobId+'&index='+i}/><div className="export-actions"><a href={'/api/download?job='+batch.jobId+'&index='+i+'&save=1'} download>Download MP4</a><button className="danger" disabled={busy} onClick={()=>setDeleteRequest([{jobId:batch.jobId,index:i,name:file.name}])}>Delete generated file</button></div></details>))}{!editor.exports.some(b=>b.files.some(f=>!f.deletedAt))&&<p className="hint">Rendered previews and exports appear here.</p>}<p className="hint">Need more space? Manage storage lists older exports too. An .ass file is a subtitle helper; the finished MP4 already contains the rendered captions.</p></section>
   </aside>
  </div>
  <div className="subtitle-downloads"><label><input type="checkbox" checked={showCaptions} onChange={e=>setShowCaptions(e.target.checked)}/> Show preview caption overlay</label>{editor.transcript.length>0&&<><a href={subtitleUrls.srt} download="onlysubs-transcript.srt">Download transcript SRT</a><a href={subtitleUrls.vtt} download="onlysubs-transcript.vtt">Download transcript WebVTT</a><p>Full-source timing. Upload alongside the full video; trimmed exports already have burned-in captions.</p></>}</div>
  <Trust remember={remember} onRemember={changeRemember}/>
 </main>
}
createRoot(document.getElementById('root')).render(<App/>)
