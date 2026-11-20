const T={T0:"Jour 4 • Acquisition des talents",T1:"T1 • L’acquisition des talents augmentée par l’IA",T2:"T2 • Machine learning dans le recrutement",T3:"T3 • Machine learning dans le staffing",T4:"T4 • Machine learning dans la sélection du personnel"};
const pages=[...document.querySelectorAll('.page')];
pages.forEach((p,i)=>{ if(p.classList.contains('cover')) return; const t=p.dataset.t||'T0';
 p.insertAdjacentHTML('afterbegin','<div class="hd"><span><b>JOUR 4</b> &nbsp;•&nbsp; Acquisition des talents</span><span>'+T[t]+'</span></div>');
 p.insertAdjacentHTML('beforeend','<div class="ft"><span>Intelligence artificielle et transformation numérique en GRH</span><span>Page '+(i+1)+' / '+pages.length+'</span></div>');});
