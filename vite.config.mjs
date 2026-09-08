import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createApi } from './server/api.cjs'
export default defineConfig({plugins:[react(),{name:'local-reel-api',configureServer(server){server.middlewares.use('/api',createApi())}}],base:'./',optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1',port:5173,strictPort:true,watch:{followSymlinks:false,ignored:['**/work/**','**/outputs/**','**/site/**']}}})
