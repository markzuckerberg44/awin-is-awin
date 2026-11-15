# Auditoría NASA, consulta por especie y ampliación

## Qué se verificó

Se consultó nuevamente el endpoint oficial `https://power.larc.nasa.gov/api/temporal/monthly/point` para las 24 localizaciones originales y las 19 con indicadores adicionales: **43 respuestas y 40.635 comparaciones numéricas coincidentes**. Incluye valores faltantes de los indicadores adicionales. No se sustituyeron las series históricas por otras nuevas.

- [auditoria-nasa.json](auditoria-nasa.json): fecha UTC, URL exacta, parámetros, unidades, hashes y resultados por consulta.
- [nasa-power/](nasa-power/): respuestas originales de temperatura, humedad y precipitación.
- [nasa-power-extra/](nasa-power-extra/): respuestas completas nuevas que permiten recalcular los indicadores adicionales, antes guardados solamente como agregados anuales.
- `python auditar_nasa.py`: repetir la consulta en línea; si hay diferencias, informa y falla, sin reemplazar el histórico.
- `python verificar_datos.py`: verificar sin red los hashes, las agregaciones y los contratos.

**Verificación independiente (15-11-2026):** se volvieron a pedir las mismas 43 consultas desde otro cliente y se compararon **todos** los valores de los archivos guardados, incluidos los promedios anuales que entrega NASA: 119.925 valores, todos idénticos (al 0,001). San Gerardo y Talamanca caen en la misma celda de NASA y tienen datos idénticos; no son comparaciones independientes.

NASA POWER distribuye productos meteorológicos basados en reanálisis y otros productos satelitales; no son mediciones in situ del animal. Consultar [fuentes y cobertura de la API mensual](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/) y [procesamiento temporal](https://power.larc.nasa.gov/docs/methodology/data/processing/). Que coincidan con NASA confirma procedencia y procesamiento, no idoneidad ecológica ni ausencia de sesgos regionales.

## La ficha determina la consulta

```text
species_id
  → survival_card.requirements[]
  → indicator_id + nasa_parameters + unit + aggregation
  → survival_card.comparison_series[location_id][indicator_id]
  → comparación o modelo temporal
```

Se añadió `consultar-series.mjs`. Es una consulta a los JSON preparados: no necesita llamar a NASA cada vez que alguien juega. Copiar el módulo y `export/` a los recursos del juego:

```js
import {consultarSeriesEspecie} from './consultar-series.mjs';
const datos = await consultarSeriesEspecie({
  speciesId: 'sapo-dorado', locationId: 'san-gerardo',
  endYear: 2014, baseUrl: '/data/pokedex'
});
for (const variable of datos.variables) {
  // indicatorId, nasaParameters, unit, aggregation, source, available, series
  dibujar(variable.series, variable.label, variable.unit);
}
```

Con `endYear: 2025` devuelve el histórico completo para análisis retrospectivo. `reference.period` conserva su propio período; no confundir su media 1981–2014 con la media de un período distinto. El cliente valida especie, lugar y tipos numéricos, y comunica las series ausentes.

## Variables registradas y parámetros reales

| Indicador del proyecto | Parámetro(s) NASA | Magnitud |
|---|---|---|
| `t2m_mean` | `T2M` | Temperatura media del aire |
| `t2m_max_mean` | `T2M_MAX` | Media anual de extremos máximos mensuales |
| `t2m_min_mean` | `T2M_MIN` | Media anual de extremos mínimos mensuales |
| `thermal_range` | `T2M_MAX`, `T2M_MIN` | Media de la diferencia entre extremos mensuales; no amplitud diaria |
| `rh2m_mean` | `RH2M` | Humedad relativa del aire |
| `precip_annual` | `PRECTOTCORR` | Suma anual de precipitación, convirtiendo mm/día a acumulados |
| `precip_dry_season` | `PRECTOTCORR` | Lluvia en cuatro meses fijados por la referencia de la especie |
| `soil_wetness` | `GWETROOT` | Humedad relativa del suelo en zona radicular, no cobertura vegetal |
| `cloud_cover` | `CLOUD_AMT` | Nubosidad regional, no niebla medida bajo el dosel |
| `surface_temp_mean` | `TS` | Temperatura superficial de la celda, no agua a profundidad |
| `surface_temp_warmest_month` | `TS` | Mayor media mensual superficial del año |
| `wind_speed` | `WS2M` | Velocidad del viento a 2 m, no corrientes del mar |

`variables-clave.json.indicators[id].nasa_parameters` es la lista explícita para construir consultas NASA. La agregación del indicador es parte de su identidad: no basta con usar el mismo parámetro. En lluvia seca, la definición de la ficha prevalece y fija los mismos meses para todos sus candidatos.

## Ampliación propuesta, sin añadir variables a las especies todavía

La base y las consultas ya admiten un número variable de indicadores; se retiró el límite técnico de tres. **Las selecciones actuales siguen siendo tres por especie**. Las pruebas incluyen una ficha de cuatro variables sin modificar el catálogo real.

Para la siguiente versión, propondría entre cuatro y seis indicadores por ficha, escogidos por la pregunta ecológica y la disponibilidad, no por llenar espacios:

- En especies terrestres: mantener temperatura, agua y humedad; evaluar un extremo térmico o nubosidad cuando aporte información distinta. Varias medidas térmicas altamente correlacionadas no son evidencia independiente.
- Días cálidos, noches frías y duración de sequías requieren series **diarias** y una definición explícita del umbral. No se pueden obtener contando días a partir de medias mensuales. Un umbral climático didáctico no debe llamarse tolerancia de la especie.
- Estrés térmico de arrecifes, temperatura del agua, caudal, nivel del mar o vegetación requieren productos apropiados y una nueva validación espacial/temporal; no sustituirlos con `TS`, lluvia o humedad del suelo sin validar la relación.

Proceso para ampliar: definir el indicador y su unidad → asignar parámetros NASA → descargar para referencia y candidatos → documentar agregación y datos faltantes → verificar fuentes → añadir el ID a `variables-clave.json.species[id].variables` → reconstruir fichas → recalcular modelos. Una variable nueva fuera de las 12 registradas necesita su agregador y su soporte en el registro; cambiar solo el JSON no crea datos.

## Modelos: lo implementado y lo pendiente

El módulo [ml/](../../ml/README.md) lee **las mismas series que la ficha** (`species_comparison_values`), incluida la lluvia seca. Se separan:

1. **2025:** predicción retrospectiva entrenada hasta 2024 y comparada con el dato NASA conocido (`hindcast_2025`).
2. **2026–2030:** pronóstico con el histórico completo hasta 2025 (`forecast`).

Desde la versión 3 el pronóstico promedia dos cosas: (a) la media de seis modelos simples (persistencia, media histórica, media reciente, tendencia lineal, Theil–Sen y regresión autorregresiva Ridge) y (b) un modelo LightGBM global que aprende de las 73 series anuales a la vez y usa como entradas la temperatura, la humedad y la lluvia del mismo lugar. La lluvia seca usa solo (a), porque sus meses se definieron con 1981–2014. Las bandas del 80 % se calibran con los errores fuera de muestra de todas las series, por horizonte.

Validación con cada serie distinta contada una vez (95 series): en 2021–2025 la banda contiene el **77 %** de los valores reales (antes 62 %) y en 2025 el **85 %** (antes 69 %). La precisión puntual es similar a la del método anterior: la variación de un año a otro en una celda es mayormente impredecible. `ml/verify.py` corrompe todos los datos posteriores a 2020 y comprueba que el backtest no cambia, lo que demuestra que ni LightGBM ve el futuro.

Los pronósticos los produce el proyecto, **no NASA**, y no son probabilidades de supervivencia ni proyecciones de modelos climáticos con escenarios de emisiones. El siguiente paso con más valor científico es incorporar escenarios CMIP6 de NASA (NEX-GDDP-CMIP6) como entrada.
