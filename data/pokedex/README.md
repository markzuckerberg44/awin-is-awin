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
| `fichas-supervivencia.json` | Ficha de supervivencia: 3 requisitos por especie con valor, fuentes y nivel de confianza |
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

## Ficha de supervivencia por especie

Cada especie tiene una ficha con sus **3 requisitos principales para sobrevivir**. Pueden ser de temperatura, agua, vegetación, nivel del mar, alimento, depredadores o enfermedades. Cada requisito parte de las «variables favorables» del PDF del proyecto y se contrastó con fuentes publicadas. Están en [`fichas-supervivencia.json`](fichas-supervivencia.json), en la tabla `survival_requirements` de SQLite y en el campo `survival_card` de cada `export/<id>.json`.

Cada requisito indica cuánto se puede confiar en él (`status`):

| Estado | Significado | Uso en el juego |
|---|---|---|
| ✅ `confirmed` | Las fuentes lo respaldan | Puede usarse como regla |
| ✏️ `corrected` | El PDF estaba equivocado; se da el valor correcto | Usar el valor corregido |
| 🟡 `partly_supported` | Respaldo cualitativo o de una especie emparentada | Mostrar como aproximado |
| ⚪ `no_published_data` | Solo lo dice el PDF; no hay datos publicados | Mostrar como referencia del PDF |

Resultado: 21 confirmados, 2 corregidos, 15 con respaldo parcial y 7 sin datos publicados.

| Especie | Requisito 1 | Requisito 2 | Requisito 3 |
|---|---|---|---|
| Bramble Cay melomys | ✏️ Land that seawater does not reach | ✅ Herbaceous vegetation for food and shelter | ⚪ Warm tropical maritime climate |
| Golden toad | 🟡 Cold, wet elfin cloud forest at 1,500–1,620 m | ⚪ Cool temperatures | ✅ Shallow rain pools during the April–June breeding season |
| Chiriquí harlequin frog | 🟡 Montane forest streams at 1,400–2,500 m | 🟡 Shaded, cloudy forest canopy | 🟡 Freedom from chytrid fungus |
| Southern gastric-brooding frog | ✅ Rocky rainforest streams and rock pools | ⚪ Cool water | 🟡 Streams that keep flowing all year |
| Northern Darwin’s frog | ✅ Wet southern-beech (Nothofagus) forest | 🟡 Cool temperatures | 🟡 Humid ground and clean water for free-living tadpoles |
| Oʻahu tree snail | ✅ Native forest trees with leaf fungi to graze | ✅ No introduced snail predators or rats | 🟡 Humid, misty montane microclimate |
| Poʻouli | ✅ Montane wet ʻōhiʻa forest at 1,400–2,100 m | ✅ Cold enough to stop avian malaria | ✅ Native land snails as main food |
| Tecopa pupfish | ✏️ Hot spring outflow water | ✅ Natural, slow-flowing outflow channels | ✅ No other pupfish or introduced fish |
| Millepora hydrocoral | ✅ No prolonged sea temperatures above ~30 °C | ⚪ Stable warm water | ✅ Shallow, sunlit reef (≤ 20 m) |
| Galápagos damsel | 🟡 Cold, nutrient-rich upwelling | ✅ Abundant zooplankton | ✅ Shallow, exposed rocky shores |
| Christmas Island forest skink | ✅ Native rainforest of Christmas Island | 🟡 No introduced predators | ⚪ Warm, humid island climate |
| Catarina pupfish | ✅ A spring that keeps flowing | ✅ No introduced predatory fish | 🟡 Clear, vegetated spring pool at about 1,880 m |
| Smooth handfish | 🟡 Shallow coastal seabed of south-east Tasmania | 🟡 Intact seabed without trawling or siltation | ⚪ Cool temperate water |
| Christmas Island pipistrelle | ✅ Old-growth forest with roost sites | ✅ Abundant flying insects | ⚪ Warm, seasonally rainy rainforest |
| Rabbs’ fringe-limbed treefrog | ✅ Water-filled tree holes for breeding | 🟡 Cloud forest at 900–1,150 m around El Valle de Antón | 🟡 Freedom from chytrid fungus |

**Correcciones importantes al PDF**
- **Melomys:** el cayo medía unos 3 m sobre la marea alta, no «más de 15 m». Lo que necesitaba era tierra con vegetación fuera del alcance del mar.
- **Pupo de Tecopa:** vivía en agua de unos 43 °C, no «nunca sobre 40 °C».
- **Millepora:** no hay evidencia de que la acidificación influyera; el límite documentado es no superar ~30 °C por períodos largos.

**Campos de cada requisito:**
- `requirement`, `category`, `value`, `range`: qué necesita la especie, de qué tipo es y, si corresponde, el rango numérico (`min`, `max` y `unit`).
- `brief_value`: lo que decía el PDF.
- `status`, `status_label`, `evidence`, `sources`: qué tan confiable es, por qué y con qué enlaces.
- `nasa_proxy`: qué variable clave de la especie lo sigue con datos NASA, cuando existe. `proxy_note` explica si se puede comparar directamente; en especies de montaña conviene comparar cambios, no valores absolutos.

```js
for (const r of ficha.survival_card.requirements) {
  mostrarRequisito(r.requirement, r.value, r.status_label);
  if (r.nasa_proxy) enlazarConSerie(ficha.key_variable_series[ficha.scenario.reference_location][r.nasa_proxy]);
}
```

## Variables clave por especie

Cada especie tiene **sus propias 3 variables principales de supervivencia**. Salen de las «variables favorables» del PDF del proyecto, traducidas a lo que NASA POWER puede medir. La definición, el motivo de cada elección y las condiciones del PDF están en [`variables-clave.json`](variables-clave.json). Los rangos numéricos del PDF se muestran solo como contexto: no son límites de supervivencia validados.

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

**Origen de los datos.** Temperatura media, humedad, lluvia anual y lluvia de la estación seca se calculan desde las series de este paquete. Las otras (temperatura máxima y mínima, temperatura de superficie o del mar, humedad del suelo, nubosidad y viento) vienen de [`nasa-power-extra-anual.json`](nasa-power-extra-anual.json), con los hashes de las respuestas de NASA; `descargar_nasa_extra.py` las vuelve a descargar. La nubosidad empieza en 1984. La humedad del suelo no existe sobre océano (Funafuti, Cocos).

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
