"""Génère les QCM du jour 1 et leurs corrigés (HTML pour conversion en Google Docs)."""
import pathlib

D = pathlib.Path(__file__).parent
HEAD = (D / "_head.txt").read_text(encoding="utf-8")
L = "ABCD"

QCM = {
"T1": ("La GRH aujourd’hui et la transformation numérique", "Matin", [
 ("Dans le modèle de Dave Ulrich (1997), quel rôle est à la fois stratégique et centré sur les personnes ?",
  ["Partenaire stratégique", "Expert administratif", "Agent du changement", "Champion des salariés"], 2,
  "L’agent du changement agit sur le long terme (stratégique) et sur les personnes (culture, transformations). Le partenaire stratégique est stratégique mais centré sur les processus."),
 ("Une entreprise remplace le formulaire papier de demande de congés par un portail en ligne avec validation électronique du manager, sans modifier les étapes. Il s’agit de :",
  ["numérisation", "digitalisation", "transformation numérique", "automatisation intelligente"], 1,
  "Le processus est exécuté plus efficacement avec le numérique, mais ses étapes restent identiques : c’est de la digitalisation (page 8)."),
 ("Scanner les dossiers papier du personnel pour les archiver en PDF relève de :",
  ["la numérisation", "la digitalisation", "la transformation numérique", "l’analytique RH"], 0,
  "Seul le support change : c’est la numérisation. Les PDF ne sont pas exploitables comme données structurées."),
 ("Quel énoncé décrit le mieux la différence entre SIRH et HCM ?",
  ["Le SIRH désigne uniquement la paie, le HCM tout le reste",
   "Le HCM est un terme d’éditeurs qui insiste sur la couverture de tout le cycle de vie et la dimension talent",
   "Le SIRH est obligatoirement installé sur site, le HCM toujours en ligne",
   "Le HCM est une IA, le SIRH n’en est pas une"], 1,
  "Les deux termes se recouvrent largement ; HCM (Human Capital Management) met l’accent sur la gestion des talents tout au long du cycle de vie (page 7)."),
 ("Selon la grille de maturité de la page 10, un processus géré dans plusieurs logiciels non connectés, avec des ressaisies, est au niveau :",
  ["1 Artisanal", "2 Outillé", "3 Intégré", "4 Piloté par la donnée"], 1,
  "Des outils existent mais ne communiquent pas : niveau 2 « outillé »."),
 ("Pourquoi la maturité numérique doit-elle être évaluée processus par processus ?",
  ["Parce que la loi l’impose",
   "Parce qu’une même organisation peut être avancée sur un processus et artisanale sur un autre",
   "Parce que les logiciels sont toujours vendus par processus",
   "Parce que l’IA ne s’applique qu’à un seul processus à la fois"], 1,
  "Une entreprise peut être au niveau 4 en paie et au niveau 1 en gestion des compétences ; un niveau global masquerait ces écarts."),
 ("Quelle affirmation sur l’expérience collaborateur est exacte ?",
  ["Une expérience fluide garantit un traitement équitable",
   "Elle ne concerne que la phase de recrutement",
   "Elle invite à concentrer les efforts sur les « moments de vérité »",
   "Elle remplace l’exigence de conformité"], 2,
  "Les moments de vérité (premier jour, erreur de paie, refus de mobilité…) pèsent le plus. Une expérience fluide n’est pas forcément équitable, et la conformité reste indispensable."),
 ("Selon le cours, quelle est la condition préalable la plus importante à un projet d’IA RH ?",
  ["Disposer du logiciel le plus récent", "La qualité et l’intégration des données",
   "Recruter un data scientist", "Obtenir l’accord de chaque salarié"], 1,
  "Une IA ne vaut que par les données qu’elle reçoit : des données dispersées et peu fiables rendent la plupart des projets irréalistes."),
]),
"T2": ("Les bases de l’intelligence artificielle", "Matin", [
 ("Selon la définition de l’AI Act (art. 3), quel élément caractérise un système d’IA ?",
  ["Il imite le cerveau humain", "Il déduit, à partir des entrées reçues, comment générer des résultats",
   "Il fonctionne sans aucune intervention humaine", "Il utilise obligatoirement des réseaux de neurones"], 1,
  "Le critère central est l’inférence : le système déduit des prédictions, contenus, recommandations ou décisions à partir de ses entrées."),
 ("Les IA utilisées aujourd’hui en RH sont :",
  ["des IA générales", "des IA étroites, spécialisées sur une tâche",
   "des IA fortes capables de raisonner sur tout domaine", "des systèmes conscients"], 1,
  "Toutes les IA actuelles en RH sont étroites : performantes sur une tâche définie, sans compétence en dehors."),
 ("Un outil qui applique 200 règles écrites par des juristes pour calculer l’éligibilité des salariés relève de :",
  ["l’apprentissage supervisé", "l’IA générative", "l’approche symbolique (système expert)", "l’apprentissage par renforcement"], 2,
  "Les connaissances sont écrites par des experts et non apprises à partir de données : c’est un système expert."),
 ("Parmi ces affirmations, laquelle est exacte ?",
  ["Le machine learning est une branche du deep learning",
   "Le deep learning est une branche du machine learning",
   "L’IA générative ne relève pas du deep learning",
   "Les systèmes experts sont une branche du machine learning"], 1,
  "Les cercles sont emboîtés : IA ⊃ machine learning ⊃ deep learning ⊃ IA générative (page 16)."),
 ("La RPA (automatisation robotisée des processus) :",
  ["apprend de ses erreurs", "est une forme de deep learning",
   "exécute des clics et des saisies selon des règles fixes, sans apprendre", "génère des textes"], 2,
  "La RPA reproduit des actions selon un scénario paramétré ; ce n’est pas de l’IA au sens strict, même si elle est souvent vendue avec des briques d’IA."),
 ("Pourquoi un grand modèle de langage peut-il « halluciner » ?",
  ["Parce qu’il est mal programmé",
   "Parce qu’il prédit la suite de texte la plus probable sans vérifier les faits",
   "Parce qu’il manque de données sur internet", "Parce qu’il est connecté à de mauvaises bases de données"], 1,
  "Un LLM produit un texte plausible, pas vérifié : il peut inventer une référence ou un chiffre avec assurance."),
 ("Un outil classe les candidatures ; le recruteur vérifie les 40 premières et un échantillon des dossiers écartés. Niveau d’autonomie ?",
  ["1 Information", "2 Assistance", "3 Augmentation encadrée", "4 Automatisation"], 2,
  "L’IA agit sur une partie du flux et l’humain contrôle et valide : niveau 3 (page 19)."),
 ("Le biais d’automatisation désigne :",
  ["la tendance d’un algorithme à discriminer",
   "la tendance des humains à suivre la recommandation de la machine sans l’examiner",
   "l’erreur d’un robot RPA", "la dégradation d’un modèle dans le temps"], 1,
  "Le contrôle humain devient une formalité si la personne n’a pas le temps, l’information ou le pouvoir de contredire la machine."),
]),
"T3": ("Le machine learning en RH : introduction", "Après-midi", [
 ("Dans la définition de Mitchell (T, E, P), que désigne P ?",
  ["Le programme", "La mesure de performance", "La population étudiée", "La prédiction"], 1,
  "T est la tâche, E l’expérience (les données), P la mesure de performance. Choisir P est un choix de gestion."),
 ("Prédire si un salarié partira dans l’année à partir de l’historique des départs relève de :",
  ["l’apprentissage supervisé", "l’apprentissage non supervisé", "l’apprentissage par renforcement", "la RPA"], 0,
  "L’issue (parti ou resté) est connue pour les exemples passés : les données sont étiquetées."),
 ("Regrouper automatiquement 5 000 commentaires d’enquête en thèmes, sans grille préalable, est une tâche de :",
  ["classification", "régression", "clustering", "recommandation"], 2,
  "Sans étiquette, on cherche des groupes : c’est du clustering (apprentissage non supervisé)."),
 ("Estimer le salaire de marché d’un poste est une tâche de :",
  ["classification", "régression", "clustering", "recommandation"], 1,
  "La sortie est une valeur numérique : c’est une régression."),
 ("Le surapprentissage (overfitting) signifie que le modèle :",
  ["a été entraîné trop longtemps sur un serveur",
   "a appris par cœur les particularités de l’historique et se trompe sur les cas nouveaux",
   "utilise trop peu de variables", "a une précision de 100 %"], 1,
  "Il réussit sur les données d’entraînement mais généralise mal ; le risque est élevé avec les petits volumes de données RH."),
 ("Sur 1 000 salariés, 100 partent. Un modèle en signale 120, dont 70 partent réellement. Quelle est sa précision ?",
  ["70 %", "58 %", "92 %", "12 %"], 1,
  "Précision = vrais positifs / signalés = 70 / 120 ≈ 58 %. Le rappel serait 70 / 100 = 70 %, l’exactitude 92 %."),
 ("Pourquoi l’exactitude (accuracy) est-elle trompeuse pour prédire les départs ?",
  ["Parce qu’elle est difficile à calculer",
   "Parce que l’événement est rare : un modèle qui ne prédit aucun départ obtient déjà une exactitude élevée",
   "Parce qu’elle ne s’applique qu’à la régression", "Parce qu’elle est interdite par le RGPD"], 1,
  "Avec 10 % de départs, prédire « personne ne part » donne 90 % d’exactitude sans rien détecter."),
 ("Laquelle de ces variables est un proxy possible d’une caractéristique protégée ?",
  ["Le poste occupé", "L’ancienneté", "Le code postal du domicile", "Le nombre d’heures supplémentaires"], 2,
  "Le code postal peut être corrélé à l’origine sociale ou ethnique : retirer les variables protégées ne suffit pas, il faut traquer leurs proxys."),
]),
"T4": ("Cartographie des applications de l’IA dans le HCM", "Après-midi", [
 ("Le sourcing automatisé de profils sur des bases externes appartient à quelle étape du cycle de vie ?",
  ["Attirer / recruter", "Intégrer", "Développer", "Accompagner le départ"], 0,
  "Le sourcing relève de l’acquisition des talents (étapes 1 et 2)."),
 ("Un assistant qui répond aux questions des salariés sur les congés en s’appuyant sur la convention collective mobilise principalement la brique :",
  ["analytique prédictive", "assistant conversationnel", "optimisation", "RPA"], 1,
  "C’est un assistant conversationnel, souvent fondé sur un LLM connecté aux documents internes."),
 ("Depuis février 2025, l’AI Act interdit sur le lieu de travail :",
  ["les chatbots RH", "la reconnaissance des émotions, sauf raisons médicales ou de sécurité",
   "la rédaction d’offres par IA générative", "la prévision des effectifs"], 1,
  "L’article 5 de l’AI Act interdit les systèmes de reconnaissance des émotions au travail, hors raisons médicales ou de sécurité."),
 ("Selon l’AI Act, un système d’IA utilisé pour trier et évaluer des candidatures est :",
  ["sans obligation particulière", "à risque limité", "à haut risque", "toujours interdit"], 2,
  "Les systèmes d’IA utilisés pour le recrutement et la sélection figurent à l’annexe III (emploi) : ils sont à haut risque."),
 ("Pourquoi raisonner en « briques technologiques transversales » ?",
  ["Pour acheter un outil différent par processus",
   "Pour comparer les offres et réutiliser un investissement d’un processus à l’autre",
   "Parce que l’AI Act l’exige", "Pour éviter de consulter les représentants du personnel"], 1,
  "Cinq briques reviennent partout ; une brique maîtrisée (assistant, gouvernance, données) peut être étendue à d’autres processus."),
 ("Dans l’approche de Renkema (Handbook, ch. 14), les conséquences de l’IA en RH s’analysent :",
  ["uniquement en termes d’économies", "à plusieurs niveaux, en distinguant effets voulus et non voulus",
   "uniquement du point de vue de la fonction RH", "uniquement à l’échelle de la société"], 1,
  "Individu, fonction RH, organisation, société ; effets recherchés et effets non voulus."),
 ("Dans la matrice de priorisation, un cas à valeur forte mais à faisabilité faible est :",
  ["à lancer en priorité", "à écarter", "un projet structurant à préparer", "une amélioration simple"], 2,
  "Il ne faut pas l’abandonner mais préparer ses conditions : données, compétences, gouvernance."),
 ("Selon la règle pratique du cours, quel premier projet privilégier à valeur égale ?",
  ["La prédiction individuelle des départs", "Le tri automatique des CV",
   "Un cas à faible risque portant sur des tâches plutôt que sur des décisions concernant des personnes",
   "L’analyse vidéo des entretiens"], 2,
  "Un premier succès à faible risque crée la confiance, l’expérience et la gouvernance nécessaires aux projets plus sensibles."),
]),
}

TARGET = {"T1": "CDABDACB", "T2": "DACBADBC", "T3": "ACDBCBDA", "T4": "BDACCABD"}
for _t, (_title, _slot, _qs) in QCM.items():
    for _i, (_q, _opts, _a, _e) in enumerate(_qs):
        _n = L.index(TARGET[_t][_i])
        _opts[_a], _opts[_n] = _opts[_n], _opts[_a]
        _qs[_i] = (_q, _opts, _n, _e)

def table_q(i, q, opts):
    rows = "".join(f"<tr><td style='width:8%'><b>{L[k]}</b></td><td>{o}</td><td style='width:10%'>☐</td></tr>" for k, o in enumerate(opts))
    return f"<h3>Question {i}</h3><p>{q}</p><table>{rows}</table>"

for t, (title, slot, qs) in QCM.items():
    head = f"<p class='k'>Intelligence artificielle et transformation numérique en GRH • Jour 1 • {slot} • {t}</p>"
    body = head + f"<h1>J1-{t} • QCM de validation des connaissances</h1>"
    body += f"<p><b>Thématique :</b> {title} • <b>Durée :</b> 6 minutes de réponse, puis 4 minutes de correction • <b>Consigne :</b> une seule bonne réponse par question ; cochez la case correspondante. Chaque bonne réponse vaut 1 point (total sur 8).</p>"
    body += "<p><b>Nom et prénom :</b> ……………………………………………</p>"
    for i, (q, opts, a, e) in enumerate(qs, 1):
        body += table_q(i, q, opts)
    body += "<h2>Grille de réponses</h2><table><tr><th>Question</th>" + "".join(f"<th>{i}</th>" for i in range(1, 9)) + "</tr><tr><td>Réponse</td>" + "<td></td>" * 8 + "</tr></table>"
    (D / f"J1-{t}_QCM.html").write_text(HEAD + body + "</body></html>", encoding="utf-8")

    cb = head.replace("</p>", " • Document formateur</p>") + f"<h1>J1-{t} • Corrigé du QCM</h1><p><b>Thématique :</b> {title}</p>"
    cb += "<h2>Réponses</h2><table><tr><th>Question</th>" + "".join(f"<th>{i}</th>" for i in range(1, 9)) + "</tr><tr><td>Bonne réponse</td>" + "".join(f"<td><b>{L[a]}</b></td>" for _, _, a, _ in qs) + "</tr></table>"
    cb += "<h2>Explications</h2>"
    for i, (q, opts, a, e) in enumerate(qs, 1):
        cb += f"<h3>Question {i} • Réponse {L[a]}</h3><p><i>{q}</i></p><p><b>{L[a]}. {opts[a]}</b></p><p>{e}</p>"
    cb += "<h2>Lecture des résultats</h2><ul><li><b>7 ou 8 :</b> notions maîtrisées.</li><li><b>5 ou 6 :</b> relire les pages du fascicule correspondant aux erreurs.</li><li><b>4 ou moins :</b> reprendre la synthèse « À retenir » de la thématique et la lecture associée avant la journée suivante.</li></ul>"
    (D / f"J1-{t}_Corrige_QCM.html").write_text(HEAD + cb + "</body></html>", encoding="utf-8")

for f in D.glob("*.body.html"):
    (D / f.name.replace(".body.html", ".html")).write_text(HEAD + f.read_text(encoding="utf-8") + "</body></html>", encoding="utf-8")
print(sorted(p.name for p in D.glob("J1-*.html") if ".body." not in p.name))
