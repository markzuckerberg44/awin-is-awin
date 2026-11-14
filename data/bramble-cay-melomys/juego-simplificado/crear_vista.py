import json
from pathlib import Path
root=Path(__file__).resolve().parent
data={'decision':json.loads((root/'decision_2015.json').read_text(encoding='utf-8')),'feedback':json.loads((root/'retroalimentacion.json').read_text(encoding='utf-8'))}
html=(root/'vista-plantilla.html').read_text(encoding='utf-8').replace('__DATA__',json.dumps(data,ensure_ascii=False,allow_nan=False).replace('</','<\\/'))
(root/'vista-previa.html').write_text(html,encoding='utf-8')
print('OK: vista-previa.html')
