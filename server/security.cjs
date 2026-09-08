const {randomBytes,timingSafeEqual}=require('crypto')
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
function headers(res){res.setHeader('Content-Security-Policy',CSP);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()')}
function createSession(){
 const token=randomBytes(32).toString('hex')
 return {token,authorize(req){const value=req.headers['x-onlysubs-session'];return typeof value==='string'&&value.length===token.length&&timingSafeEqual(Buffer.from(value),Buffer.from(token))}}
}
module.exports={headers,createSession,CSP}
