import fs from 'node:fs'
let t = fs.readFileSync('index.html', 'utf8')
const rep = [
  ['vos taches et atteignez', 'vos tâches et atteignez'],
  ['Periode', 'Période'],
  ['Avancement global de vos taches', 'Avancement global de vos tâches'],
  ['Repartition des taches', 'Répartition des tâches'],
  ['Executees<b', 'Exécutées<b'],
  ['Non executees<b', 'Non exécutées<b'],
  ['Comparaison temps prevu / temps reel', 'Comparaison temps prévu / temps réel'],
  ['Dans le rythme prevu', 'Dans le rythme prévu'],
  ['Temps prevu', 'Temps prévu'],
  ['Temps reellement utilise', 'Temps réellement utilisé'],
  ['Evolution de la progression', 'Évolution de la progression'],
  ['Detail des taches du jour', 'Détail des tâches du jour'],
  ['Repartition visuelle de vos taches', 'Répartition visuelle de vos tâches'],
  ['<b>Executees</b>', '<b>Exécutées</b>'],
  ['<b>Non executees</b>', '<b>Non exécutées</b>'],
  ['<span>taches</span>', '<span>tâches</span>'],
  ['Non executees<em', 'Non exécutées<em'],
  ['Resume de la semaine', 'Résumé de la semaine'],
  ['Taches executees</p>', 'Tâches exécutées</p>'],
  ['Dans les delais</p>', 'Dans les délais</p>'],
  ['Taches en retard</p>', 'Tâches en retard</p>'],
  ['Par rapport a la semaine derniere', "Par rapport à la semaine dernière"],
  ['Tu es plus regulier cette semaine !', 'Tu es plus régulier cette semaine !'],
  ['Continue sur cette lancee, tu fais de grands progres.', 'Continue sur cette lancée, tu fais de grands progrès.'],
  ['Voir le detail -&gt;', 'Voir le détail -&gt;'],
]
for (const [a, b] of rep) t = t.split(a).join(b)
fs.writeFileSync('index.html', t)
console.log('accents OK')
