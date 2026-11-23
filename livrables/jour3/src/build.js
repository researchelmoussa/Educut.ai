const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const [,, kind, out] = process.argv; const dir=__dirname;
(async()=>{
 let body, css;
 if(kind==='fascicule'){
  css=fs.readFileSync(path.join(dir,'fascicule.css'),'utf8');
  body=['p00','p_t1','p_t2','p_t3','p_t4'].map(f=>fs.readFileSync(path.join(dir,f+'.html'),'utf8')).join('\n');
 } else {
  css=fs.readFileSync(path.join(dir,'script.css'),'utf8');
  body=fs.readFileSync(path.join(dir,kind+'.html'),'utf8');
 }
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Space+Grotesk:wght@500;700&display=swap"><style>${css}</style></head><body>${body}
 <script>${kind==='fascicule'?fs.readFileSync(path.join(dir,'decorate.js'),'utf8'):''}</script></body></html>`;
 fs.writeFileSync(path.join(dir,'_'+kind+'.html'),html);
 const b=await chromium.launch(); const p=await b.newPage();
 await p.setContent(html,{waitUntil:'networkidle'});
 const opt = kind==='fascicule' ? {path:out,width:'297mm',height:'210mm',printBackground:true} :
  {path:out,format:'A4',printBackground:true,margin:{top:'18mm',bottom:'18mm',left:'18mm',right:'18mm'},displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;padding:0 18mm;display:flex;justify-content:space-between;color:#56687a;font-family:sans-serif"><span>'+(kind==='scripts'?'Jour 3 • Scripts du formateur':'Jour 3 • Intelligence artificielle et transformation numérique en GRH')+'</span><span class="pageNumber"></span></div>'};
 await p.pdf(opt); await b.close();
})();
