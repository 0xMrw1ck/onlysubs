import test from 'node:test'
import assert from 'node:assert/strict'
import {exportRanges,outputDimensions,exportQualities} from '../shared/exports.mjs'
const clip=(start,end,selected=true)=>({start,end,selected})
test('combined ranges sort, merge overlaps/adjacency and skip unchecked footage',()=>{
 const input=[clip(30,40),clip(10,20),clip(0,10),clip(9,15),clip(20,30,false),clip(10,12)]
 const snapshot=structuredClone(input)
 assert.deepEqual(exportRanges(input,40,{combine:true}).map(({start,end})=>[start,end]),[[0,20],[30,40]])
 assert.deepEqual(input,snapshot)
 assert.equal(exportRanges(input,40).length,5)
})
test('invalid and empty selections fail; full video ignores checked range limits',()=>{
 assert.throws(()=>exportRanges([],40),/Select/)
 for(const c of [clip(-1,2),clip(1,1),clip(0,41),clip(NaN,1),clip(40,40.1)])assert.throws(()=>exportRanges([c],40),/Cut times/)
 assert.deepEqual(exportRanges([clip(4,8)],40,{fullVideo:true}).map(({start,end})=>[start,end]),[[0,40]])
 assert.equal(exportRanges([clip(30,40.1)],40)[0].end,40)
})
test('original export does not scale and social frames centre-crop without upscaling',()=>{
  assert.deepEqual(outputDimensions({width:3840,height:2160}),{width:3840,height:2160})
  assert.deepEqual(outputDimensions({width:1279,height:719}),{width:1280,height:720})
  assert.deepEqual(outputDimensions({width:1280,height:720},'vertical'),{width:396,height:704})
  assert.deepEqual(outputDimensions({width:1280,height:720},'portrait'),{width:576,height:720})
  assert.deepEqual(outputDimensions({width:1280,height:720},'square'),{width:720,height:720})
  assert.deepEqual(outputDimensions({width:1280,height:720},'landscape'),{width:1056,height:594})
  assert.deepEqual(outputDimensions({width:2160,height:3840},'vertical'),{width:1080,height:1920})
 assert.ok(exportQualities.high.crf<20)
 assert.ok(exportQualities.maximum.crf<exportQualities.high.crf)
})
