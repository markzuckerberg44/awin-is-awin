# Datos de biodiversidad para el juego

Este directorio es un **paquete de datos**, no la interfaz del juego ni una API alojada. El equipo puede integrar los JSON en cualquier motor o consultar SQLite desde su backend. No hace falta ejecutar Python para utilizar los datos exportados.

## Qué utilizar

| Archivo | Uso |
|---|---|
| `export/catalogo.json` | Listar las 15 fichas, localizaciones, variables y fuentes biológicas/metodológicas |
| `export/<id>.json` | Series, ciclos mensuales, estadísticas, candidatos y retroalimentación por ficha |
| `pokedex.sqlite` | Consultas SQL sobre el catálogo completo y las 24 localizaciones |
| `manifest-nasa.json` y `nasa-power/` | Consultas NASA, unidades originales, respuestas originales y hashes |
| `catalogo-curado.json` | Fichas revisadas y trazabilidad de las sustituciones |
| `METODOLOGIA.md` | Cálculos, interpretación, supuestos y límites científicos |

Hay 15 entradas totales (incluido el melomys), 24 localizaciones y datos de 1981–2025. Diez fichas tienen comparación climática entre tres candidatos. Las cinco acuáticas tienen ejercicios sobre evidencia faltante: **aún no incluyen tres refugios acuáticos validados ni series del agua**.

## Integración web sin base de datos instalada

Copiar `export/` a los recursos públicos del juego, por ejemplo `public/data/pokedex/`. Servirlos desde el mismo dominio del juego:

```js
async function cargarJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${url}: ${r.status}`);
  return r.json();
}
const base = '/data/pokedex';
const catalogo = await cargarJSON(`${base}/catalogo.json`);
const ficha = await cargarJSON(`${base}/${encodeURIComponent(catalogo.species[0].id)}.json`);
const sitio = ficha.scenario.reference_location;
const variable = 'T2M'; // RH2M o PRECTOTCORR
const mensual = ficha.series[sitio].monthly
  .filter(r => r.year <= 2014) // el juego ocurre en 2015
  .map(r => ({x: r.date, y: r[variable]}));
const anual = ficha.series[sitio].annual
  .filter(r => r.year <= 2014) // el juego ocurre en 2015
  .map(r => ({x: r.year, y: r[variable]}));
const ciclo = ficha.climatology[sitio][variable]; // 12 meses, enero–diciembre
const testReferencia = ficha.reference_trends.archivo_1981_2014[variable];
// Tendencias de referencia Y candidatos en las rondas terrestres:
const comparacion = ficha.scenario.adjusted_tests?.archivo_1981_2014 ?? [];
const testErub = comparacion.find(t => t.location_id === 'erub' && t.variable === variable);
// Tras responder: mostrar ficha.scenario.feedback, scores y climatology.
```

Para una inspección rápida también se pueden descargar desde GitHub Raw, por ejemplo:
https://raw.githubusercontent.com/markzuckerberg44/awin-is-awin/data-analysis/data/pokedex/export/catalogo.json

Para distribuir el juego, copiar una versión fija de los datos o fijar el SHA de un commit en la URL; una rama puede cambiar. GitHub almacena los archivos: **no ejecuta consultas SQL ni el backend del juego**.

## Predicciones (machine learning)

El pronóstico 2026–2030 de las tres variables clave de cada especie está en el módulo independiente [`ml/`](../../ml/README.md), en inglés. No modifica este paquete de datos.

## SQLite desde un backend

Descargar `pokedex.sqlite`; abrirlo en modo de solo lectura. Ejemplo con Python estándar:

```python
import sqlite3
db = sqlite3.connect('file:pokedex.sqlite?mode=ro', uri=True)
fichas = db.execute('SELECT id, name, scientific_name FROM species ORDER BY number').fetchall()
serie = db.execute('''SELECT date, value, unit FROM observations
    WHERE location_id=? AND variable=? AND frequency=? ORDER BY date''',
    ('erub', 'T2M', 'annual')).fetchall()
db.close()
```

El progreso de cada jugador lo implementa el equipo en su juego, separado de este catálogo. Las respuestas del ejercicio están en `scenario.accepted_answers`; si quieren ocultarlas, conservarlas en su backend, no en el navegador.

## Reglas al mostrar los datos

- **Idioma:** los textos que ve el jugador (nombres, fichas, preguntas, opciones, retroalimentación, sellos y unidades) están en inglés. Los `id` y nombres de campos no cambiaron. Sellos: `REAL ↑`, `REAL ↓`, `NOT PROVEN`, `NOT TESTABLE`.
- Temperatura: °C; humedad: %. Precipitación exportada: mm/month en la serie mensual y mm/year en la anual. NASA original entrega mm/día, ya convertido en las exportaciones.
- El juego ocurre en 2015 (`scenario.scenario_year`). Comparación educativa: 1981–2014. Retrospectiva: 1981–2025. Filtrar las series al período del test seleccionado.
- Mann–Kendall original y Hamed–Rao son variantes del mismo test. Un p pequeño indica evidencia de tendencia, **no** un buen o mal refugio.
- `p_corrected: null` significa test no evaluable; mostrarlo como tal. No convertirlo a cero. Hay cuatro casos documentados.
- `slope_per_decade` mide magnitud. Los candidatos se comparan con ciclos mensuales y el índice descrito en metodología, no con el menor p.
- No presentar rangos del PDF como límites de supervivencia: `validated_tolerance_limits` es null. Tampoco presentar todas las fichas como extinciones confirmadas por cambio climático.

## Reproducir y verificar

Desde este directorio:

```sh
python verificar_datos.py
# Solo para recalcular (requiere dependencias):
python -m pip install -r requirements.txt
python seed.py
python descargar_nasa.py
python construir_db.py
python verificar_datos.py
```

El paquete no contiene progreso personal, servidor local ni interfaz. Las fuentes y los scripts permiten auditar y reconstruir el conjunto.
