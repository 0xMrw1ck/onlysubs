const http=require('http')
const fs=require('fs/promises')
const path=require('path')
const {createApi}=require('./api.cjs')
const security=require('./security.cjs')
function startServer(port=0,{session=null}={}){
  const api=createApi({authorize:session?.authorize}),web=path.resolve(__dirname,'../dist')
  const server=http.createServer(async(req,res)=>{
    security.headers(res)
    if(req.url.startsWith('/api/')){req.url=req.url.slice(4);return api(req,res)}
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
      const file=path.resolve(web,'.'+(pathname==='/'?'/index.html':pathname))
      if(!file.startsWith(web+path.sep))throw new Error('Invalid path')
      const data=await fs.readFile(file)
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data)
    }catch{res.writeHead(404);res.end('Not found')}
  })
  return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)))
}
if(require.main===module)startServer(Number(process.env.PORT)||5173).then(server=>console.log('onlysubs: http://127.0.0.1:'+server.address().port))
module.exports={startServer}
