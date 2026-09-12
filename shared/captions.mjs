export const captionFonts = ['Arial', 'Verdana', 'Georgia', 'Courier New', 'Tahoma']
export const presets = {
  pop: { label: 'Bold outline', color: '#ffffff', size: .046, weight: 800, outline: .003 },
  yellow: { label: 'Yellow punch', color: '#ffe34d', size: .046, weight: 800, outline: .003 },
  clean: { label: 'Clean minimal', color: '#ffffff', size: .037, weight: 500, outline: .0018 },
  soft: { label: 'Soft subtitle', color: '#f2f2f2', size: .039, weight: 500, outline: .0018 },
}

// Original word timings are retained only while their text matches the edited row.
// Older transcripts and corrections use proportional timing within that row.
export function captionCues(transcript = []) {
  const cues = []
  for (const row of transcript) {
    if (!Number.isFinite(row.start) || !Number.isFinite(row.end) || !(row.end > row.start) || !row.text?.trim()) continue
    const textWords = row.text.trim().split(/\s+/)
    const original = row.words || []
    const exact = original.length === textWords.length && original.every((w,i) => (w.word || '').trim() === textWords[i] && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= row.start && w.end <= row.end && w.end > w.start)
    const weights = textWords.map(w => w.length + 1)
    const total = weights.reduce((a,b) => a+b, 0)
    let elapsed = 0
    const words = textWords.map((word,i) => {
      const start = row.start + (row.end-row.start)*elapsed/total
      elapsed += weights[i]
      return exact ? {...original[i], word} : {word,start,end:row.start+(row.end-row.start)*elapsed/total}
    })
    let group = []
    const flush = () => {
      if (group.length) cues.push({start:Math.max(row.start,group[0].start),end:Math.min(row.end,group.at(-1).end),text:group.map(w=>w.word).join(' '),estimated:!exact})
      group = []
    }
    for (const word of words) {
      if (group.length && (group.length >= 5 || [...group,word].map(w=>w.word).join(' ').length > 32 || word.start-group.at(-1).end > .35)) flush()
      group.push(word)
      if (/[.!?]$/.test(word.word)) flush()
    }
    flush()
  }
  return cues.sort((a,b)=>a.start-b.start)
}
const colour=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback
export function captionStyle(preset, width, height, scale = 1, bottom = 12, options = {}) {
  const p = presets[preset] || presets.clean
  const base = Math.min(width,height)
  return {...p,fontFamily:captionFonts.includes(options.captionFont)?options.captionFont:'Arial',color:colour(options.captionColor,p.color),backgroundColor:colour(options.captionBackground,'#101010'),backgroundOpacity:Math.max(0,Math.min(100,Number(options.captionBackgroundOpacity)||0)),fontSize:Math.round(base*p.size*Math.max(.6,Math.min(1.6,Number(scale)||1))), stroke:base*p.outline, margin:height*Math.max(5,Math.min(35,Number(bottom)||12))/100}
}
export function captionLines(text) {
  const words=text.split(/\s+/), lines=['']
  for(const word of words) {
    if(lines.at(-1).length+word.length+1>24 && lines.length<2) lines.push(word)
    else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word
  }
  return lines
}
const time=s=>{const n=Math.max(0,Math.round(s*100));return `${Math.floor(n/360000)}:${String(Math.floor(n/6000)%60).padStart(2,'0')}:${String(Math.floor(n/100)%60).padStart(2,'0')}.${String(n%100).padStart(2,'0')}`}
export function makeAss(transcript, start, end, width, height, options={}) {
  const style=captionStyle(options.captionPreset,width,height,options.captionScale,options.captionBottom,options)
  const assColour=(hex,alpha='00')=>`&H${alpha}${hex.slice(5,7)}${hex.slice(3,5)}${hex.slice(1,3)}`
  const color=assColour(style.color), background=assColour(style.backgroundColor,(255-Math.round(style.backgroundOpacity*255/100)).toString(16).padStart(2,'0').toUpperCase())
  const boxed=style.backgroundOpacity>0
  const head=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,${style.fontFamily},${style.fontSize},${color},${color},&H00101010,${background},${style.weight>600?-1:0},0,0,0,100,100,0,0,${boxed?3:1},${boxed?Math.max(2,style.fontSize*.11).toFixed(2):style.stroke.toFixed(2)},0,2,${Math.round(width*.06)},${Math.round(width*.06)},${Math.round(style.margin)},1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`
  return head+captionCues(transcript).filter(c=>c.end>start&&c.start<end).map(c=>{
    const clean=c.text.replace(/[{}\\]/g,'').replace(/[\r\n]/g,' ')
    return `Dialogue: 0,${time(Math.max(0,c.start-start))},${time(Math.min(end,c.end)-start)},Default,,0,0,0,,${captionLines(clean).join('\\N')}`
  }).join('\n')+'\n'
}
