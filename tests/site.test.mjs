import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
test('private website has valid local links and no local-editor API or tracking integration',async()=>{
 const root=path.resolve('site/dist'),files=await fs.readdir(root)
 for(const name of files.filter(n=>n.endsWith('.html'))){
  const html=await fs.readFile(path.join(root,name),'utf8')
  assert.match(html,/<html lang="en">/)
  assert.doesNotMatch(html,/127\.0\.0\.1|localhost:|\/api\/|<iframe|googletagmanager|google-analytics/i)
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   const target=match[1].split('#')[0];if(!target||/^(https?:|mailto:)/.test(target))continue
   const file=path.resolve(root,target==='./'?'index.html':target)
   assert.ok(file.startsWith(root+path.sep),target)
   await fs.access(file)
  }
 }
 const index=await fs.readFile(path.join(root,'index.html'),'utf8')
 assert.match(index,/Public download not published yet/)
 assert.doesNotMatch(await fs.readFile(path.join(root,'demo.js'),'utf8'),/fetch\(|localStorage|document\.cookie/)
})
