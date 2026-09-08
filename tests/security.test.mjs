import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {subtitleText} from '../shared/subtitles.mjs'
const require=createRequire(import.meta.url),{createSession,CSP}=require('../server/security.cjs')
test('session secrets are unique and reject absent and incorrect credentials',()=>{
 const a=createSession(),b=createSession()
 assert.notEqual(a.token,b.token)
 assert.equal(a.authorize({headers:{}}),false)
 assert.equal(a.authorize({headers:{'x-onlysubs-session':b.token}}),false)
 assert.equal(a.authorize({headers:{'x-onlysubs-session':a.token}}),true)
 assert.match(CSP,/script-src 'self'/);assert.match(CSP,/frame-ancestors 'none'/)
})
test('subtitle downloads retain timing and strip markup',()=>{
 const rows=[{start:1.25,end:2.5,text:'<b>Hello</b> world'}]
 assert.match(subtitleText(rows,'srt'),/00:00:01,250 --> 00:00:02,500/)
 assert.match(subtitleText(rows,'vtt'),/^WEBVTT/)
 assert.doesNotMatch(subtitleText(rows),/<b>/)
 assert.throws(()=>subtitleText(rows,'ass'))
})
