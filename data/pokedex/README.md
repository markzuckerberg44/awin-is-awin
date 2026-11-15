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
| `fichas-supervivencia.json` | Ficha numérica: 3 indicadores por especie con media, rango observado, unidad, período y fuente |
| `variables-clave.json` | Las 3 variables NASA con que se sigue a cada especie, con su justificación |
| `nasa-power-extra-anual.json` | Variables NASA adicionales (máx./mín., mar, suelo, nubes, viento) en valores anuales, con hashes |
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

## Fichas numéricas por especie

**Usar [FICHAS-NUMERICAS.md](FICHAS-NUMERICAS.md)**: contrato 2.0.0, 45 indicadores numéricos (3 por especie), medias, rangos observados, unidades, períodos y diferencias entre referencia y candidatos. Los requisitos ecológicos escritos se conservan aparte en `requisitos-ecologicos.json` y `habitat_evidence`.

Los números describen el clima regional de referencia; no son umbrales de supervivencia. `survival_card.requirements[].value` ahora es un número, no una frase. Consultar la migración antes de integrar.

## Variables clave por especie

Cada especie tiene **sus propios 3 indicadores ambientales de contexto**. Salen de las «variables favorables» del PDF del proyecto, traducidas a lo que NASA POWER puede medir. La definición, el motivo de cada elección y las condiciones del PDF están en [`variables-clave.json`](variables-clave.json). Los rangos numéricos del PDF se muestran solo como contexto: no son límites de supervivencia validados.

| Especie | Variable 1 | Variable 2 | Variable 3 |
|---|---|---|---|
| `melomys` · Bramble Cay melomys | Average monthly maximum temperature (`t2m_max_mean`) | Annual rainfall (`precip_annual`) | Root-zone soil wetness (`soil_wetness`) |
| `sapo-dorado` · Golden toad | Mean relative humidity (`rh2m_mean`) | Mean air temperature (`t2m_mean`) | Dry-season rainfall (`precip_dry_season`) |
| `arlequin-chiriqui` · Chiriquí harlequin frog | Mean air temperature (`t2m_mean`) | Cloud cover (`cloud_cover`) | Monthly temperature range (`thermal_range`) |
| `rana-gastrica` · Southern gastric-brooding frog | Mean air temperature (`t2m_mean`) | Dry-season rainfall (`precip_dry_season`) | Root-zone soil wetness (`soil_wetness`) |
| `darwin-norte` · Northern Darwin’s frog | Mean air temperature (`t2m_mean`) | Mean relative humidity (`rh2m_mean`) | Dry-season rainfall (`precip_dry_season`) |
| `caracol-oahu` · Oʻahu tree snail | Mean air temperature (`t2m_mean`) | Mean relative humidity (`rh2m_mean`) | Dry-season rainfall (`precip_dry_season`) |
| `poouli` · Poʻouli | Mean air temperature (`t2m_mean`) | Average monthly minimum temperature (`t2m_min_mean`) | Annual rainfall (`precip_annual`) |
| `pupo-tecopa` · Tecopa pupfish | Average monthly maximum temperature (`t2m_max_mean`) | Annual rainfall (`precip_annual`) | Root-zone soil wetness (`soil_wetness`) |
| `millepora` · Millepora hydrocoral | Mean surface (skin) temperature (`surface_temp_mean`) | Warmest-month surface temperature (`surface_temp_warmest_month`) | Wind speed at 2 m (`wind_speed`) |
| `damisela-galapagos` · Galápagos damsel | Mean surface (skin) temperature (`surface_temp_mean`) | Warmest-month surface temperature (`surface_temp_warmest_month`) | Wind speed at 2 m (`wind_speed`) |
| `eslizón-christmas` · Christmas Island forest skink | Average monthly maximum temperature (`t2m_max_mean`) | Mean relative humidity (`rh2m_mean`) | Dry-season rainfall (`precip_dry_season`) |
| `pupo-catarina` · Catarina pupfish | Annual rainfall (`precip_annual`) | Average monthly maximum temperature (`t2m_max_mean`) | Root-zone soil wetness (`soil_wetness`) |
| `pez-mano` · Smooth handfish | Mean surface (skin) temperature (`surface_temp_mean`) | Warmest-month surface temperature (`surface_temp_warmest_month`) | Wind speed at 2 m (`wind_speed`) |
| `pipistrelo-christmas` · Christmas Island pipistrelle | Mean air temperature (`t2m_mean`) | Dry-season rainfall (`precip_dry_season`) | Mean relative humidity (`rh2m_mean`) |
| `rana-rabbs` · Rabbs’ fringe-limbed treefrog | Mean air temperature (`t2m_mean`) | Dry-season rainfall (`precip_dry_season`) | Cloud cover (`cloud_cover`) |

**En cada ficha** (`export/<id>.json`):

- `key_variables`: las 3 variables con `label`, `unit` y cómo se calculan. Incluye además:
  - las condiciones del PDF (`brief_favorable_conditions`, con `brief_ranges_validated: false`);
  - el motivo de la elección (`why_these_variables`);
  - avisos: `absolute_value_caution` para especies de montaña, `rainfall_caution`, `not_available` y `dry_season_months`.
- `key_variable_series`: un valor por año (1981–2025) de cada variable, para el hábitat y, en las especies terrestres, sus 3 refugios candidatos. Una lista vacía significa que NASA no tiene esa variable en ese lugar; en ese caso `not_available` lo indica.

```js
const ficha = await cargarJSON(`${base}/${encodeURIComponent(id)}.json`);
for (const v of ficha.key_variables.variables) {
  const serie = ficha.key_variable_series[ficha.scenario.reference_location][v.id]; // [{year, value}, ...]
  mostrarVariable(v.label, v.unit, serie);
}
```

**En SQLite:** `key_indicators` (definiciones), `species_key_variables` (3 por especie, con `rank`), `key_indicator_values` (valor anual por localización) y `dry_season` (meses secos de cada lugar).

```sql
SELECT k.label, k.unit, v.year, v.value
FROM species_key_variables s
JOIN key_indicators k ON k.id = s.indicator_id
JOIN key_indicator_values v ON v.indicator_id = s.indicator_id
WHERE s.species_id = 'sapo-dorado' AND v.location_id = 'monteverde'
ORDER BY s.rank, v.year;
```

**Origen de los datos.** Temperatura media, humedad, lluvia anual y lluvia de la estación seca se calculan desde las series de este paquete. Las otras (temperatura máxima y mínima, temperatura superficial de la celda, humedad del suelo, nubosidad y viento) vienen de [`nasa-power-extra-anual.json`](nasa-power-extra-anual.json), con los hashes de las respuestas de NASA; `descargar_nasa_extra.py` las vuelve a descargar. La nubosidad empieza en 1984. La humedad del suelo no existe sobre océano (Funafuti, Cocos).

El pronóstico 2026–2030 de estas mismas variables está en [`ml/`](../../ml/README.md).

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


## Auditoría y consulta guiada por especie

[Informe, contrato de consulta y propuesta de ampliación](AUDITORIA-Y-AMPLIACION.md): 43 consultas oficiales y 40.635 valores coincidentes con NASA. El helper `consultar-series.mjs` obtiene las variables desde la ficha. El modelo en `ml/` utiliza esas mismas series, separa la evaluación retrospectiva de 2025 del pronóstico 2026–2030 y combina seis modelos simples con un LightGBM global, con bandas del 80 % calibradas.
