import test from 'node:test'
import assert from 'node:assert/strict'
import {captionCues,makeAss} from '../shared/captions.mjs'
test('short timed phrases preserve exact words, pauses and boundaries',()=>{
 const rows=[{start:1,end:7,text:'one two three four five six',words:[{word:'one',start:1,end:1.2},{word:'two',start:1.3,end:1.5},{word:'three',start:1.6,end:1.9},{word:'four',start:2,end:2.3},{word:'five',start:2.4,end:2.7},{word:'six',start:5,end:6}]}]
 const cues=captionCues(rows)
 assert.equal(cues.length,2);assert.equal(cues[1].start,5);assert.equal(cues[1].end,6)
 assert.ok(cues.every(c=>!c.estimated&&c.text.split(' ').length<=5))
 const changed=captionCues([{...rows[0],text:'edited subtitle wording'}]);assert.ok(changed.every(c=>c.estimated))
 const shifted=captionCues([{...rows[0],start:10,end:16}]);assert.ok(shifted.every(c=>c.estimated&&c.start>=10&&c.end<=16&&c.end>c.start))
})
test('ASS declares real frame dimensions and rebases clipped cues',()=>{
 const ass=makeAss([{start:4,end:7,text:'A caption'},{start:9,end:11,text:'A later caption'}],5,10,1920,1080,{captionPreset:'clean'})
 assert.match(ass,/PlayResX: 1920/);assert.match(ass,/PlayResY: 1080/)
 assert.match(ass,/Dialogue: 0,0:00:00.00,0:00:02.00/)
 assert.match(ass,/Dialogue: 0,0:00:04.00,0:00:05.00/)
 assert.doesNotMatch(makeAss([],0,10,1080,1920),/Dialogue:/)
})
