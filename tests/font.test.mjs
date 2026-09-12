import test from 'node:test'
import assert from 'node:assert/strict'
import {captionStyle,makeAss,captionFonts} from '../shared/captions.mjs'
test('preview and export use the same allowlisted font with legacy fallback',()=>{
 for(const captionFont of captionFonts){
  assert.equal(captionStyle('clean',1080,1920,1,12,{captionFont}).fontFamily,captionFont)
  assert.ok(makeAss([],0,1,1080,1920,{captionFont}).includes('Style: Default,'+captionFont+','))
 }
 assert.equal(captionStyle('clean',1080,1920).fontFamily,'Arial')
 assert.ok(makeAss([],0,1,1080,1920,{captionFont:'Bad,\\n[Events]'}).includes('Style: Default,Arial,'))
})
