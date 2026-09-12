const $=id=>document.getElementById(id)
let timer=null
const stamp=n=>'0:'+String(Math.floor(n)).padStart(2,'0')
function position(){const t=Number($('playhead').value);$('playhead-label').textContent=stamp(t);$('playhead').setAttribute('aria-valuetext',stamp(t)+' of 0:30');$('caption-preview').hidden=t<Number($('start').value)||t>=Number($('end').value)}
function stop() {clearInterval(timer);timer=null;$('play').textContent='Play caption demonstration'}
function update(){stop();$('character-count').textContent=Array.from($('caption').value).length+' characters · demo limit 100';$('caption-preview').dataset.font=$('font').selectedIndex;$('caption-preview').textContent=$('caption').value;$('caption-preview').className='caption '+$('preset').value;const start=Number($('start').value),end=Number($('end').value),valid=Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end<=30&&end>start;$('selection').textContent=valid?`${(end-start).toFixed(1).replace(/\.0$/,'')} seconds selected`:'Choose a start before the end, within 0–30 seconds.';$('play').disabled=!valid;if(valid)$('playhead').value=start;position()}
for(const id of ['caption','preset','font','start','end'])$(id).addEventListener('input',update)
$('playhead').addEventListener('input',()=>{stop();position()})
$('play').addEventListener('click',()=>{if(timer)return stop();$('playhead').value=$('start').value;$('play').textContent='Pause demonstration';position();timer=setInterval(()=>{const n=Number($('playhead').value)+.1;$('playhead').value=Math.min(n,Number($('end').value));position();if(n>=Number($('end').value))stop()},100)})
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()})
update()
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController()
 const tool={name:'configure_caption_demo',title:'Configure onlysubs caption demo',description:'Set the visible illustrative caption style and selected range. Does not process, upload, or export a real video.',inputSchema:{type:'object',properties:{text:{type:'string',maxLength:100},style:{type:'string',enum:['clean','pop','yellow','soft']},start:{type:'number',minimum:0,maximum:29},end:{type:'number',minimum:1,maximum:30}},required:['text','style','start','end'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input.text!=='string'||input.text.length>100||!['clean','pop','yellow','soft'].includes(input.style)||!Number.isFinite(input.start)||!Number.isFinite(input.end)||input.start<0||input.start>29||input.end>30||input.end<1||input.end<=input.start)throw new Error('Invalid demo caption or range');$('caption').value=input.text;$('preset').value=input.style;$('start').value=input.start;$('end').value=input.end;update();return {text:$('caption').value,style:$('preset').value,seconds:input.end-input.start,demo:true}}}
 try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true})
}
