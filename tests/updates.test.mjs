import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {EventEmitter} from 'node:events'
const code=fs.readFileSync(new URL('../electron/updates.cjs',import.meta.url),'utf8')
function fixture(){
 const updater=new EventEmitter(),messages=[],webContents=new EventEmitter();let menu,checks=0,downloads=0
 updater.checkForUpdates=async()=>{checks++};updater.downloadUpdate=async()=>{downloads++}
 const electron={app:{isPackaged:true,getVersion:()=> '0.4.0'},dialog:{showMessageBox:async(_w,options)=>{messages.push(options);return {response:1}}},Menu:{buildFromTemplate:x=>x,setApplicationMenu:x=>{menu=x}}}
 const sandbox={require:name=>name==='electron'?electron:{autoUpdater:updater},module:{exports:{}}}
 vm.runInNewContext(code,sandbox)
 sandbox.module.exports.setupUpdates({webContents,setProgressBar(){},setTitle(){}})
 return {updater,messages,webContents,check:()=>menu[3].submenu[0].click(),checks:()=>checks,downloads:()=>downloads,electron}
}
test('startup checks automatically but never downloads without agreement',async()=>{
 const f=fixture();f.webContents.emit('did-finish-load');assert.equal(f.checks(),1)
 assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.allowDowngrade,false)
 f.updater.emit('update-available',{version:'0.5.0'});await new Promise(r=>setImmediate(r));assert.equal(f.downloads(),0)
})
test('approved download installs on exit and failures keep the editor usable',async()=>{
 const f=fixture();f.electron.dialog.showMessageBox=async()=>({response:0})
 f.updater.emit('update-available',{version:'0.5.0'});await new Promise(r=>setImmediate(r))
 assert.equal(f.downloads(),1);assert.equal(f.updater.autoInstallOnAppQuit,true)
 f.updater.emit('error',new Error('offline'));await f.check();assert.equal(f.checks(),1)
})
