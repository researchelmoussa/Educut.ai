const T={T0:"Jour 5 • Développement et gestion des talents",T1:"T1 • Formation et développement",T2:"T2 • Gestion des talents",T3:"T3 • Analytique prédictive : engagement et attrition",T4:"T4 • Affective computing et expérience collaborateur"};
const pages=[...document.querySelectorAll('.page')];
pages.forEach((p,i)=>{ if(p.classList.contains('cover')) return; const t=p.dataset.t||'T0';
 p.insertAdjacentHTML('afterbegin','<div class="hd"><span><b>JOUR 5</b> &nbsp;•&nbsp; Développement et gestion des talents</span><span>'+T[t]+'</span></div>');
 p.insertAdjacentHTML('beforeend','<div class="ft"><span>Intelligence artificielle et transformation numérique en GRH</span><span>Page '+(i+1)+' / '+pages.length+'</span></div>');});
