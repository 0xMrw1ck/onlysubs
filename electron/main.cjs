const {app,BrowserWindow,dialog}=require('electron')
const path=require('path'),fs=require('fs')
// Preserve the previous packaged application's saved projects after the rename.
const previousData=['local-reel-studio','Local Reel Studio'].map(name=>path.join(app.getPath('appData'),name)).find(folder=>fs.existsSync(folder))
if(app.isPackaged&&previousData)app.setPath('userData',previousData)
let server
app.whenReady().then(async()=>{
 try{
  const session=require('../server/security.cjs').createSession()
  let url='http://127.0.0.1:5173'
  if(!process.argv.includes('--dev')){
    if(app.isPackaged)process.env.REEL_DATA_ROOT=app.getPath('userData')
    server=await require('../server/start.cjs').startServer(0,{session})
    url='http://127.0.0.1:'+server.address().port
  }
  const win=new BrowserWindow({title:'onlysubs — a clipping tool for everyone',icon:path.join(__dirname,app.isPackaged?'../dist/onlysubs-logo.png':'../public/onlysubs-logo.png'),width:1500,height:950,minWidth:900,minHeight:650,backgroundColor:'#0b101a',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}})
  const origin=new URL(url).origin
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false))
  win.webContents.session.setPermissionCheckHandler(()=>false)
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  win.webContents.on('will-navigate',(event,target)=>{if(new URL(target).origin!==origin)event.preventDefault()})
  if(!process.argv.includes('--dev'))win.webContents.session.webRequest.onBeforeSendHeaders((details,callback)=>{
    const request=new URL(details.url)
    if(request.origin!==origin)return callback({cancel:true})
    callback({requestHeaders:{...details.requestHeaders,'X-Onlysubs-Session':session.token}})
  })
  win.loadURL(url)
 }catch(error){dialog.showErrorBox('onlysubs could not start',error.message);app.quit()}
})
app.on('window-all-closed',()=>{server?.close();app.quit()})
