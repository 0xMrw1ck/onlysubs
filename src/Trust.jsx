import React,{useEffect,useRef,useState} from 'react'
import {policies,publisher} from '../shared/policies.mjs'
export function Modal({title,onClose,children}){
 const ref=useRef(null)
 useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>{ref.current?.close();previous?.focus?.()}},[])
 return <dialog className="trust-dialog" ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();onClose?.()}}><h2>{title}</h2>{children}{onClose&&<button onClick={onClose}>Close</button>}</dialog>
}
export function Trust({remember,onRemember}){
 const [page,setPage]=useState(null),[accepted,setAccepted]=useState(()=>{try{return localStorage.getItem('onlysubs-consent-v1')===publisher.version}catch{return false}}),[rights,setRights]=useState(false)
 function accept(){try{localStorage.setItem('onlysubs-consent-v1',publisher.version)}catch{}setAccepted(true)}
 return <><footer className="trust-footer"><span>WickWorks · Free portfolio preview · Ages 13+</span><div>{Object.entries(policies).map(([key,p])=><button key={key} onClick={()=>setPage(key)}>{p.title}</button>)}</div><label><input type="checkbox" checked={remember} onChange={e=>onRemember(e.target.checked)}/> Keep an additional browser draft on this device</label><p>Disk project recovery remains enabled. No analytics, tracking pixels, or third-party embeds.</p></footer>
 {!accepted&&<Modal title="Welcome to onlysubs"><p>Free local clipping and captions for ages 13+. If you are under 18, ask your parent or guardian to review and accept the terms with you.</p><p>Your imported video, extracted audio, transcript, and exports stay on this PC. The Windows app includes its processing tools; the selected speech model downloads automatically on first transcription. Saved projects remain until removed; keep backups.</p><p>WickWorks operates from the Philippines. These are review-stage notices; final hosting and legal operator details are still pending.</p><div className="trust-links">{['terms','privacy','cookies'].map(key=><button key={key} onClick={()=>setPage(key)}>{policies[key].title}</button>)}</div><label><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/> I am at least 13, agree to the Terms (with my parent or guardian if under 18), and will only process media I have permission or another lawful basis to use.</label><p>Privacy acknowledgement is not consent to marketing or tracking; neither is enabled.</p><button className="primary" disabled={!rights} onClick={accept}>Agree and open editor</button></Modal>}
 {page&&<Modal title={policies[page].title} onClose={()=>setPage(null)}><p>Updated {publisher.version} · Review draft</p>{policies[page].sections.map(([title,text])=><section key={title}><h3>{title}</h3><p>{text}</p></section>)}</Modal>}</>
}
