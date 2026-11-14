# Archivo vivo: base de datos y colección de biodiversidad

Base SQLite real para consultar fichas, datos NASA y análisis. Hay **15 entradas totales**: el melomys ya está en el PDF, así que no se duplica. Son 14 especies y una subespecie (el pupo de Tecopa). Las filas ambiguas 11 y 12 fueron reemplazadas, con autorización, por **Emoia nativitatis** y **Megupsilon aporus**.

## Qué está listo y qué no

| Entrega | Cantidad / alcance |
|---|---|
| Fichas identificadas y revisadas | 15 |
| Localizaciones regionales | 24 |
| Datos NASA | 1981–2025; 540 meses completos por localización |
| Valores mensuales y anuales | 42.120 (incluye 3 variables) |
| Tendencias sitio-variable-período | 144 |
| Valores de climatología de 12 meses | 864 |
| Ejercicios de semejanza climática | 10, con referencia y 3 candidatos |
| Ejercicios de evidencia acuática faltante | 5 |
| Umbrales fisiológicos validados | 0; no se inventan |

Las **diez rondas terrestres** incluyen las series mensual/anual, Sen, MK original y Hamed–Rao, tres localizaciones y devolución comparativa. Son ejercicios de análogos climáticos regionales. En anfibios, el caudal, agua, enfermedad y microhábitat siguen sin validarse. La selección no es una recomendación ecológica de traslado. Para que las condiciones no medidas no determinen arbitrariamente la respuesta, se supone que son equivalentes entre las tres fichas; ese supuesto es ficción didáctica.

Los **cinco casos acuáticos** (Tecopa, Millepora, Azurina, Catarina y pez mano) tienen ficha, clima del aire del entorno, tendencias de contexto y ejercicio que se puede completar de reconocer la evidencia que falta. **Todavía no tienen tres arriendos acuáticos ni datos validados de temperatura del agua, salinidad, oxígeno, profundidad o caudal.** No se sustituyen por temperatura/humedad del aire. Para completar esas rondas de selección de refugio haría falta elegir sitios y reunir esas series. La colección puede completarse resolviendo los ejercicios actuales, sin afirmar supervivencia.

Los puntos regionales se escogieron de forma aproximada dentro de las regiones citadas. Son elecciones de muestreo del analista, no coordenadas comprobadas de cada población ni de un terreno. No se simula topografía local con la grilla POWER; esto es especialmente limitante en bosque nuboso, islas pequeñas y montañas. Los candidatos continentales o de otras islas son comparadores pedagógicos; no se afirma viabilidad de introducción.

## Correcciones al PDF

El documento no es una lista científicamente validada de 15 extinciones causadas por cambio climático. Se conserva la trazabilidad de cada fila y de sus rangos no validados en la tabla `audit` y en `catalogo-curado.json`.

- **Millepora boschmai:** la evaluación UICN publicada en 2024 es DD, con posible extirpación en Panamá y distribución/taxonomía inciertas. No etiquetar extinción global.
- **Sympterichthys unipennis:** EX de 2020 revisado a DD en 2021. No etiquetar extinción confirmada.
- **Ecnomiohyla rabborum** y **Rhinoderma rufum:** conservar el carácter de posible extinción en las fuentes citadas; no convertir el año del último registro o cautivo en año de declaración EX.
- **Tecopa:** taxón de rango subespecie; alteración de manantiales documentada, no demostración de calentamiento global como causa.
- Para las demás especies, distinguir evidencia climática, ENSO, enfermedad, invasoras y pérdida de hábitat. `climate_attribution` expresa el alcance de lo respaldado, no una probabilidad causal. Los estados llevan la fuente y el año consultados; no son verificación continua de todos los registros mundiales.
- El PDF ofrece rangos de temperatura/humedad y altura sin referencias individuales. Se almacenan como afirmaciones no validadas y `validated_tolerance_limits` es null. No se usan para conceder o quitar puntos.

## Datos y estadística

`nasa-power/` contiene respuestas originales de NASA; `manifest-nasa.json`, las consultas exactas, encabezados y SHA-256. 1981–2025 completo; no se incluye 2026 parcial. No hay interpolación ni valores faltantes aceptados. Fuentes biológicas en `sources`, enlazadas mediante `species_sources`.

La lluvia mensual se convierte de mm/día a mm/mes multiplicando por los días reales; los totales anuales suman esos meses. Temperatura y humedad anual se ponderan por días. En `observations`, la columna `unit` evita confundir tasas y acumulados.

Sen mide cambio por década sobre años completos. MK original y Hamed–Rao son variantes del mismo test, no dos pruebas independientes. Hamed–Rao usa los rezagos significativos de los rangos tras quitar Sen; se guarda sensibilidad con máximos 1/3 rezagos. **Tres resultados tienen corrección de varianza no positiva**: Tasmania/HR/1981–2025, El Valle/T/1981–2025 y Santa Fe/T/1981–2008. En ellos `p_corrected` es null, con razón explícita; no se sustituye otro método silenciosamente ni se muestra p=0. Se necesita revisión estadística adicional para inferencia en esos casos.

Holm usa una familia de 12 pruebas por ronda terrestre y período (referencia + 3 candidatos × 3 variables). Los tests no evaluables conservan su lugar en el tamaño familiar, no reciben p ajustado ni sello significativo. Esto evita reducir artificialmente el número de pruebas. Los resultados individuales se muestran con su p sin ajuste; Holm va en detalles. No confundir p pequeño con hábitat favorable.

Semejanza: RMSE entre los 12 meses típicos de cada candidato y la referencia, separado por variable. El índice del ejercicio es la media de esos RMSE divididos por la desviación estándar de los 336 valores mensuales de la referencia en 1981–2008. Los pesos iguales son una regla didáctica, **no pesos fisiológicos ni un modelo de supervivencia**. Se aceptan empates numéricos. El clima más parecido entre estos tres candidatos puede ser inadecuado biológicamente.

La fecha de escenario del melomys es 2009. En las otras fichas se usa una recreación retrospectiva, sin fecha histórica de reubicación inventada: varias especies desaparecieron antes o durante la cobertura NASA. Las series posteriores no constituyen datos que se conocían entonces. La vista permite cambiar al análisis 1981–2025, pero la comparación del ejercicio usa siempre 1981–2008 y lo indica explícitamente.

## Modelo de datos

`species` → `species_sources` → `sources` guardan las fichas y evidencia. `locations` → `observations` / `climatology` / `trends` guardan datos ambientales compartidos (sin duplicar una serie para el murciélago y el eslizón de Christmas). `scenarios` y `scenario_locations` enlazan preguntas y candidatos. `audit` registra la revisión del documento. El progreso está en otra base.

Ejemplo SQL:

```sql
SELECT number,name,scientific_name,status FROM species ORDER BY number;
SELECT date,value,unit FROM observations
WHERE location_id='bramble-cay' AND variable='T2M' AND frequency='annual'
ORDER BY date;
SELECT payload FROM trends
WHERE location_id='erub' AND variable='T2M' AND period='archivo_1981_2008';
```

## Integración y reproducción

Consultar [README.md](README.md) para JSON, SQLite y comandos de validación. Este paquete contiene datos y análisis; la interfaz y el progreso del jugador pertenecen al juego que desarrolle el equipo.

