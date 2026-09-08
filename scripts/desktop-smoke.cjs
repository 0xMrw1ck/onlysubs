// Isolated app-owned smoke test; never loads the user's application data.
const {app,BrowserWindow}=require('electron')
const fs=require('fs/promises'),path=require('path')
app.whenReady().then(async()=>{
 let server
 try{
  const temp=await fs.mkdtemp(path.resolve('work/desktop-smoke-'));process.env.REEL_DATA_ROOT=temp;app.setPath('userData',temp)
  const session=require('../server/security.cjs').createSession()
  server=await require('../server/start.cjs').startServer(0,{session})
  const origin='http://127.0.0.1:'+server.address().port
  if((await fetch(origin+'/api/settings')).status!==401)throw Error('Unauthenticated API was not denied')
  const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}})
  win.webContents.session.webRequest.onBeforeSendHeaders((details,callback)=>callback({requestHeaders:{...details.requestHeaders,'X-Onlysubs-Session':session.token}}))
  const errors=[];win.webContents.on('console-message',(_e,level,message)=>{if(level===3)errors.push(message)})
  await win.loadURL(origin)
  const result=await win.webContents.executeJavaScript(`new Promise(resolve=>{let attempts=0;const timer=setInterval(()=>{const dialog=document.querySelector('dialog[open]');if(dialog||++attempts>30){clearInterval(timer);resolve({title:document.title,dialog:dialog?.textContent,buttons:document.querySelectorAll('button').length,nodeAccess:typeof window.require})}},100)})`)
  if(!result.dialog?.includes('Welcome to onlysubs')||result.nodeAccess!=='undefined')throw Error('Desktop UI smoke failed: '+JSON.stringify(result))
  const authenticated=await win.webContents.executeJavaScript(`fetch('/api/settings').then(r=>r.status)`)
  if(authenticated!==200)throw Error('Renderer could not authenticate')
  await fs.writeFile(path.join(temp,'result.json'),JSON.stringify({...result,authenticated,errors},null,2))
  console.log('DESKTOP_SMOKE_OK '+JSON.stringify({title:result.title,buttons:result.buttons,authenticated,nodeAccess:result.nodeAccess,errors}))
  win.destroy();server.close();app.exit(0)
 }catch(error){console.error(error);server?.close();app.exit(1)}
})
