const T={T0:"Jour 2 • Données RH",T1:"T1 • Machine learning sur données textuelles",T2:"T2 • Machine learning sur données audio et vidéo",T3:"T3 • Machine learning sur données des réseaux sociaux",T4:"T4 • Représentation des connaissances et raisonnement"};
const pages=[...document.querySelectorAll('.page')];
pages.forEach((p,i)=>{ if(p.classList.contains('cover')) return; const t=p.dataset.t||'T0';
 p.insertAdjacentHTML('afterbegin','<div class="hd"><span><b>JOUR 2</b> &nbsp;•&nbsp; Les données RH au service de l’IA</span><span>'+T[t]+'</span></div>');
 p.insertAdjacentHTML('beforeend','<div class="ft"><span>Intelligence artificielle et transformation numérique en GRH</span><span>Page '+(i+1)+' / '+pages.length+'</span></div>');});
