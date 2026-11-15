# Fichas numéricas para comparar el clima

## Resultado de la revisión

La versión anterior tenía 45 requisitos con `value` de tipo texto; 29 tenían `range: null`. Mezclaba observaciones históricas, descripciones, rangos del PDF sin validar y referencias a otras especies. Algunos `nasa_proxy` vinculaban magnitudes distintas (por ejemplo, altitud con humedad). Un estado editorial `confirmed` no convierte una observación en un umbral de supervivencia.

Ahora **cada una de las 15 fichas tiene tres indicadores numéricos**, conservando los indicadores específicos elegidos en `variables-clave.json`. Los textos ecológicos anteriores se conservan aparte en `requisitos-ecologicos.json`, `habitat_evidence` y la tabla `habitat_requirements`. No se ha vuelto a validar aquí cada afirmación biológica de esa revisión anterior.

## Contrato 2.0.0

Usar `export/<id>.json → survival_card`, o `fichas-supervivencia.json → species[id]`. El nombre heredado `survival_card` se conserva, pero los números son **referencias climáticas regionales**, no límites fisiológicos.

| Campo de `requirements[]` | Tipo / significado |
|---|---|
| `indicator_id` | Clave exacta de la serie que se debe comparar |
| `value` | Número: media de los valores anuales en el período de referencia |
| `range.min`, `range.max` | Números: menor y mayor valor anual observado en ese período |
| `unit` | Unidad de `value`, rango, series y diferencias |
| `period.start_year`, `end_year`, `n_years` | Números: cobertura real, hasta 2014; nubosidad desde 1984 |
| `aggregation`, `medium` | Qué mide ese número: aire, suelo, precipitación o superficie |
| `months` | Meses numéricos para lluvia seca; `null` si no aplica |
| `sources` | Consulta NASA exacta, archivo y hash |
| `physiological_limit_validated` | Siempre `false`; no se deduce una tolerancia biológica |

`comparisons[locationId][indicatorId]` contiene `value`, `reference_value` y `delta_from_reference`, todos numéricos cuando `available` es `true`. La diferencia se calcula sobre los mismos años disponibles en ambas localizaciones. `comparison_years` enumera esos años. Si no hay datos compatibles: `available: false`, números `null` y `missing_reason`; no hay valor cero de relleno.

`comparison_series[locationId][indicatorId]` contiene `{year, value}` anuales de 1981–2025. Filtrar hasta 2014 en la elección de 2015. Las cifras posteriores son retrospectivas, no información disponible para la elección.

## Uso sin analizar frases

```js
const ficha = await fetch(`/data/pokedex/${encodeURIComponent(id)}.json`).then(r => r.json());
const card = ficha.survival_card;
for (const variable of card.requirements) {
  const comparacion = card.comparisons[candidateId]?.[variable.indicator_id];
  if (!comparacion?.available) {
    mostrarSinDatos(variable.label);
    continue;
  }
  // Solo dar formato al pintar; los valores siguen siendo números para calcular.
  mostrarComparacion({
    nombre: variable.label,
    unidad: variable.unit,
    referencia: comparacion.reference_value,
    candidato: comparacion.value,
    diferencia: comparacion.delta_from_reference,
    minimoObservado: variable.range.min,
    maximoObservado: variable.range.max,
  });
  const puntos = card.comparison_series[candidateId][variable.indicator_id]
    .filter(r => r.year <= 2014);
}
```

En SQLite, `survival_requirements.value`, `range_min` y `range_max` son `REAL`, no `TEXT`. Las series equivalentes están en `species_comparison_values`:

```sql
SELECT indicator_id, value, range_min, range_max, unit, start_year, end_year, n_years
FROM survival_requirements WHERE species_id = 'sapo-dorado' ORDER BY rank;

SELECT year, value FROM species_comparison_values
WHERE species_id = 'sapo-dorado' AND location_id = 'san-gerardo'
  AND indicator_id = 'precip_dry_season' AND year <= 2014 ORDER BY year;
```

## Comparaciones que sí corresponden

- Media anual con media anual del **mismo indicador**; nunca media con máximo ni temperatura del aire con temperatura de un manantial.
- El rango observado es de valores anuales, no de temperaturas instantáneas ni de los 12 meses típicos. Estar dentro no demuestra supervivencia; estar fuera no demuestra muerte.
- La lluvia seca de la ficha usa los cuatro meses más secos del **sitio de referencia**, seleccionados con 1981–2014. Los mismos meses se suman en cada candidato, aunque no sean sus propios meses más secos. Pueden ser meses no consecutivos.
- Las antiguas `key_variable_series.precip_dry_season` usan meses propios de cada sitio, seleccionados con 1981–2025; se conservan como series heredadas. Para comparar las nuevas fichas, usar `survival_card.comparison_series`, que tiene su propia definición y tabla. El módulo ML actualizado también utiliza ``species_comparison_values`` y coincide con las nuevas fichas. No mezclar las series heredadas con esas predicciones.
- `T2M_MAX` / `T2M_MIN` son extremos, distintos de `T2M` y de los promedios diarios de extremos. Ver la [definición temporal oficial de NASA POWER](https://power.larc.nasa.gov/docs/methodology/data/processing/).
- `TS` es temperatura de la superficie (*skin*), no temperatura comprobada del agua a la profundidad del animal. Ver [NASA POWER Monthly Meteorology](https://gis.earthdata.nasa.gov/portal/rest/services/POWER/POWER_MONTHLY_METEOROLOGY_LST/ImageServer/multiDimensionalInfo). En las cinco especies acuáticas la ficha sigue marcada como contexto regional; faltan series acuáticas y candidatos validados.

La comparación ecológica debe combinar las cifras climáticas con la evidencia de hábitat. El programa puede calcular diferencias numéricas; no debe convertirlas en una probabilidad de supervivencia ni puntuar bosque, alimento o depredadores como si fueran humedad o temperatura.

## Migración

- Esquema del catálogo/SQLite y de la ficha: `2.0.0`.
- Antes, `survival_card.requirements[].value` era una frase. Ahora es un número. Etiqueta: `label`; indicador: `indicator_id`; fuentes: `sources`.
- El antiguo contenido descriptivo está en `habitat_evidence.requirements[]`. Sus etiquetas de revisión y rangos históricos no autorizan reglas automáticas.
- `fichas-supervivencia.json` es generado por `construir_db.py` mediante `fichas_numericas.py`; no editar números a mano.
- El período 2015, los textos del jugador en inglés y el módulo ML existente se conservan.

Validación: `python data/pokedex/verificar_datos.py` desde la raíz del repositorio.


## Consulta automática, ampliación y auditoría

Véase [AUDITORIA-Y-AMPLIACION.md](AUDITORIA-Y-AMPLIACION.md). Cada indicador tiene `nasa_parameters` explícitos. `consultar-series.mjs` selecciona las series desde la ficha sin imponer tres variables. Las selecciones actuales siguen siendo tres; ampliar requiere justificar y verificar cada indicador nuevo.
