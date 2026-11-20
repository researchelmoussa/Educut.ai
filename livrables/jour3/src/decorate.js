const T={T0:"Jour 3 • Core RH et automatisation",T1:"T1 • Core HR et gestion des effectifs",T2:"T2 • Automatisation robotisée des processus RH",T3:"T3 • Calcul évolutionnaire et optimisation",T4:"T4 • Agents conversationnels et NLP en RH"};
const pages=[...document.querySelectorAll('.page')];
pages.forEach((p,i)=>{ if(p.classList.contains('cover')) return; const t=p.dataset.t||'T0';
 p.insertAdjacentHTML('afterbegin','<div class="hd"><span><b>JOUR 3</b> &nbsp;•&nbsp; Core RH, automatisation et optimisation</span><span>'+T[t]+'</span></div>');
 p.insertAdjacentHTML('beforeend','<div class="ft"><span>Intelligence artificielle et transformation numérique en GRH</span><span>Page '+(i+1)+' / '+pages.length+'</span></div>');});
