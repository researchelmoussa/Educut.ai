"""Génère les QCM du jour et leurs corrigés (HTML pour conversion en Google Docs)."""
import pathlib, sys
D = pathlib.Path(__file__).parent
sys.path.insert(0, str(D))
from qcm_data import QCM, TARGET, DAY
HEAD = (D / "_head.txt").read_text(encoding="utf-8")
L = "ABCD"
J = DAY.replace("Jour ", "J")
for t, (title, slot, qs) in QCM.items():
    qs = [list(q) for q in qs]
    for i, q in enumerate(qs):
        opts = list(q[1]); a = q[2]; n = L.index(TARGET[t][i])
        opts[a], opts[n] = opts[n], opts[a]
        q[1], q[2] = opts, n
    head = f"<p class='k'>Intelligence artificielle et transformation numérique en GRH • {DAY} • {slot} • {t}</p>"
    body = head + f"<h1>{J}-{t} • QCM de validation des connaissances</h1>"
    body += f"<p><b>Thématique :</b> {title} • <b>Durée :</b> 6 minutes de réponse, puis 4 minutes de correction • <b>Consigne :</b> une seule bonne réponse par question ; cochez la case correspondante. Chaque bonne réponse vaut 1 point (total sur 8).</p>"
    body += "<p><b>Nom et prénom :</b> ……………………………………………</p>"
    for i, (q, opts, a, e) in enumerate(qs, 1):
        rows = "".join(f"<tr><td style='width:8%'><b>{L[k]}</b></td><td>{o}</td><td style='width:10%'>☐</td></tr>" for k, o in enumerate(opts))
        body += f"<h3>Question {i}</h3><p>{q}</p><table>{rows}</table>"
    body += "<h2>Grille de réponses</h2><table><tr><th>Question</th>" + "".join(f"<th>{i}</th>" for i in range(1, 9)) + "</tr><tr><td>Réponse</td>" + "<td></td>" * 8 + "</tr></table>"
    (D / f"{J}-{t}_QCM.html").write_text(HEAD + body + "</body></html>", encoding="utf-8")
    cb = head.replace("</p>", " • Document formateur</p>") + f"<h1>{J}-{t} • Corrigé du QCM</h1><p><b>Thématique :</b> {title}</p>"
    cb += "<h2>Réponses</h2><table><tr><th>Question</th>" + "".join(f"<th>{i}</th>" for i in range(1, 9)) + "</tr><tr><td>Bonne réponse</td>" + "".join(f"<td><b>{L[q[2]]}</b></td>" for q in qs) + "</tr></table><h2>Explications</h2>"
    for i, (q, opts, a, e) in enumerate(qs, 1):
        cb += f"<h3>Question {i} • Réponse {L[a]}</h3><p><i>{q}</i></p><p><b>{L[a]}. {opts[a]}</b></p><p>{e}</p>"
    cb += "<h2>Lecture des résultats</h2><ul><li><b>7 ou 8 :</b> notions maîtrisées.</li><li><b>5 ou 6 :</b> relire les pages du fascicule correspondant aux erreurs.</li><li><b>4 ou moins :</b> reprendre la synthèse « À retenir » de la thématique et la lecture associée avant la journée suivante.</li></ul>"
    (D / f"{J}-{t}_Corrige_QCM.html").write_text(HEAD + cb + "</body></html>", encoding="utf-8")
for f in D.glob("*.body.html"):
    (D / f.name.replace(".body.html", ".html")).write_text(HEAD + f.read_text(encoding="utf-8") + "</body></html>", encoding="utf-8")
print(sorted(p.name for p in D.glob(f"{J}-*.html") if ".body." not in p.name))
