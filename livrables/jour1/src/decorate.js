const T={T0:"Jour 1 • Fondements",T1:"T1 • La GRH aujourd’hui et la transformation numérique",T2:"T2 • Les bases de l’intelligence artificielle",T3:"T3 • Le machine learning en RH : introduction",T4:"T4 • Cartographie des applications de l’IA dans le HCM"};
const pages=[...document.querySelectorAll('.page')];
pages.forEach((p,i)=>{ if(p.classList.contains('cover')) return; const t=p.dataset.t||'T0';
 p.insertAdjacentHTML('afterbegin','<div class="hd"><span><b>JOUR 1</b> &nbsp;•&nbsp; Fondements : la GRH à l’ère numérique et les bases de l’IA</span><span>'+T[t]+'</span></div>');
 p.insertAdjacentHTML('beforeend','<div class="ft"><span>Intelligence artificielle et transformation numérique en GRH</span><span>Page '+(i+1)+' / '+pages.length+'</span></div>');});
