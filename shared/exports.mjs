export const exportQualities = {
  high: {label:'High quality · recommended', crf:16, preset:'medium'},
  maximum: {label:'Maximum quality · larger file / slower', crf:12, preset:'slow'},
  balanced: {label:'Balanced · smaller file / faster', crf:20, preset:'fast'}
}

export function outputDimensions(metadata, layout='original') {
  const width=Number(metadata?.width)||1920, height=Number(metadata?.height)||1080
  // Do not enlarge a low-resolution crop to 1080×1920: it only magnifies blur.
  if(layout==='vertical'){
    const units=Math.max(1,Math.floor(Math.min(1080/18,width/18,height/32)))
    return {width:units*18,height:units*32}
  }
  return {width:Math.ceil(width/2)*2,height:Math.ceil(height/2)*2}
}

export function exportRanges(clips, duration, {fullVideo=false,combine=false}={}) {
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Cannot determine source duration.')
  const selected=fullVideo?[{start:0,end:duration,title:'Full-video'}]:clips.filter(c=>c.selected)
  if(!selected.length)throw new Error('Select at least one clip.')
  for(const c of selected)if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||c.start>=duration||c.end>duration+.25)throw new Error('Cut times must be within the video duration.')
  const ranges=selected.map(c=>({...c,end:Math.min(c.end,duration)}))
  if(!combine)return ranges
  const merged=[]
  for(const c of ranges.sort((a,b)=>a.start-b.start||a.end-b.end)){
    const previous=merged.at(-1)
    if(previous&&c.start<=previous.end+1e-6)previous.end=Math.max(previous.end,c.end)
    else merged.push({...c})
  }
  return merged
}
