export const exportQualities = {
  high: {label:'High quality · recommended', crf:16, preset:'medium'},
  maximum: {label:'Maximum quality · larger file / slower', crf:12, preset:'slow'},
  balanced: {label:'Balanced · smaller file / faster', crf:20, preset:'fast'}
}

export const socialPlatforms = {
  tiktok: {label:'TikTok', layout:'vertical'},
  reels: {label:'Instagram Reels', layout:'vertical'},
  instagram: {label:'Instagram feed', layout:'portrait'},
  facebook: {label:'Facebook feed', layout:'portrait'},
  x: {label:'X', layout:'landscape'},
  youtube: {label:'YouTube', layout:'landscape'},
  custom: {label:'Custom preview', layout:'original'},
}

const layouts = {
  vertical: [9,16],
  portrait: [4,5],
  square: [1,1],
  landscape: [16,9],
}

export function outputDimensions(metadata, layout='original') {
  const width=Number(metadata?.width)||1920, height=Number(metadata?.height)||1080
  const ratio=layouts[layout]
  // Social formats centre-crop to fill their frame. Never enlarge a small source
  // simply to reach a platform's nominal 1080-pixel size.
  if(ratio){
    const [x,y]=ratio
    let units=Math.max(1,Math.floor(Math.min(1080/x,width/x,height/y)))
    if((x%2||y%2)&&units>1)units-=units%2
    return {width:Math.max(2,units*x),height:Math.max(2,units*y)}
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
