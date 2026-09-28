import re

f = 'c:\\Users\\user\\Gestionnaire de tâche\\index.html'
c = open(f, encoding='utf-8').read()

# dashPrevBtn: remove arrow before "Précédent"
c = re.sub(r'(id="dashPrevBtn" class="mtasks2__page-btn">)\s*\S+\s*Pr', r'\1Pr', c, count=1)

# dashNextBtn: remove arrow after "Suivant"
c = re.sub(r'(id="dashNextBtn" class="mtasks2__page-btn">Suivant)\s*\S+\s*</button>', r'\1</button>', c, count=1)

open(f, 'w', encoding='utf-8').write(c)
print('DONE')