import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
test('the packaged updater uses the public asset-only update channel',async()=>{
 const pkg=JSON.parse(await fs.readFile('package.json','utf8'))
 assert.equal(pkg.build.publish[0].provider,'github')
 assert.equal(pkg.build.publish[0].owner,'0xMrw1ck')
 assert.equal(pkg.build.publish[0].repo,'onlysubs-updates')
 assert.match(await fs.readFile('scripts/build-site.mjs','utf8'),/releaseRepo='onlysubs-updates'/)
})
