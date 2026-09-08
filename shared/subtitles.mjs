import {captionCues} from './captions.mjs'
function stamp(seconds,separator){const n=Math.round(Math.max(0,seconds)*1000);return [Math.floor(n/3600000),Math.floor(n/60000)%60,Math.floor(n/1000)%60].map(v=>String(v).padStart(2,'0')).join(':')+separator+String(n%1000).padStart(3,'0')}
export function subtitleText(transcript,format='vtt'){
 if(!['srt','vtt'].includes(format))throw new Error('Unsupported subtitle format')
 const sep=format==='srt'?',':'.'
 return (format==='vtt'?'WEBVTT\n\n':'')+captionCues(transcript).map((c,i)=>`${i+1}\n${stamp(c.start,sep)} --> ${stamp(c.end,sep)}\n${c.text.replace(/<[^>]*>/g,'').replace(/-->/g,'→')}\n`).join('\n')
}
