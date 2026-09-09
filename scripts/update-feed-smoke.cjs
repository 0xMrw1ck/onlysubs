const {app}=require('electron')
const fs=require('fs'),path=require('path')
const {autoUpdater}=require('electron-updater')
const output=path.resolve('work/update-feed-smoke.json')
app.whenReady().then(async()=>{
 autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=false
 autoUpdater.forceDevUpdateConfig=true
 autoUpdater.updateConfigPath=path.resolve('work/windows-free-beta-final/win-unpacked/resources/app-update.yml')
 autoUpdater.on('error',()=>{})
 try{const result=await autoUpdater.checkForUpdates();fs.writeFileSync(output,JSON.stringify({ok:true,version:result.updateInfo.version,files:result.updateInfo.files.map(f=>({url:f.url,size:f.size,sha512:f.sha512}))}));app.exit(0)}
 catch(e){fs.writeFileSync(output,JSON.stringify({ok:false,error:e.message}));app.exit(1)}
})
