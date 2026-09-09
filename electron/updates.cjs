const {app,dialog,Menu}=require('electron')
const {autoUpdater}=require('electron-updater')

// No repository credentials are distributed to clients. This feed must be public.
function setupUpdates(win){
 autoUpdater.autoDownload=false
 autoUpdater.autoInstallOnAppQuit=true
 autoUpdater.allowDowngrade=false
 autoUpdater.allowPrerelease=false
 let checking=false,manual=false,downloading=false,downloaded=false
 const message=(message,detail)=>dialog.showMessageBox(win,{type:'info',title:'onlysubs updates',message,detail})
 async function check(userRequested=false){
  if(downloading)return message('Downloading update','The update installs after you close onlysubs. Your projects remain on this PC.')
  if(downloaded)return message('Update ready','Finish your work and close onlysubs to install the update.')
  if(checking)return
  if(!app.isPackaged)return message('Updates are available in the installed app','Development builds do not install updates.')
  checking=true;manual=userRequested
  try{await autoUpdater.checkForUpdates()}catch{checking=false}
 }
 autoUpdater.on('update-available',async info=>{
  checking=false
  const answer=await dialog.showMessageBox(win,{type:'info',title:'Free update available',message:`onlysubs ${info.version} is available`,detail:'The Free tier remains free. Download now and install when you close the app. Your projects and models are preserved.',buttons:['Download update','Later'],defaultId:0,cancelId:1})
  if(answer.response===0){downloading=true;autoUpdater.downloadUpdate().catch(()=>{})}
 })
 autoUpdater.on('download-progress',p=>{win.setProgressBar(p.percent/100);win.setTitle(`onlysubs — downloading update ${Math.floor(p.percent)}%`)})
 autoUpdater.on('update-downloaded',()=>{downloading=false;downloaded=true;win.setProgressBar(-1);win.setTitle('onlysubs — Free beta');message('Update ready to install','Finish your work. The update will install when you close onlysubs. No payment is required.')})
 autoUpdater.on('update-not-available',()=>{checking=false;if(manual)message('You are up to date',`onlysubs ${app.getVersion()} · Permanent Free tier`)})
 autoUpdater.on('error',()=>{checking=false;const notify=manual||downloading;downloading=false;win.setProgressBar(-1);win.setTitle('onlysubs — Free beta');if(notify)message('Could not update right now','You can keep using onlysubs offline. Try Help → Check for updates later.')})
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'File',submenu:[{role:'quit'}]},
  {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'View',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
  {label:'Help',submenu:[{label:'Check for updates',click:()=>check(true)},{label:'About onlysubs Free',click:()=>message(`onlysubs ${app.getVersion()} — Free beta`,'Core transcription, caption editing, manual clips, combined and full exports remain free. Future optional paid features will be separate. Update checks contact GitHub; videos and transcripts stay on your PC.')} ]}
 ]))
 win.webContents.once('did-finish-load',()=>{if(app.isPackaged)check(false)})
}
module.exports={setupUpdates}
