# Auditoría NASA, consulta por especie y ampliación

## Qué se verificó

Se consultó nuevamente el endpoint oficial `https://power.larc.nasa.gov/api/temporal/monthly/point` para las 24 localizaciones originales y las 19 con indicadores adicionales: **43 respuestas y 40.635 comparaciones numéricas coincidentes**. Incluye valores faltantes de los indicadores adicionales. No se sustituyeron las series históricas por otras nuevas.

- [auditoria-nasa.json](auditoria-nasa.json): fecha UTC, URL exacta, parámetros, unidades, hashes y resultados por consulta.
- [nasa-power/](nasa-power/): respuestas originales de temperatura, humedad y precipitación.
- [nasa-power-extra/](nasa-power-extra/): respuestas completas nuevas que permiten recalcular los indicadores adicionales, antes guardados solamente como agregados anuales.
- `python auditar_nasa.py`: repetir la consulta en línea; si hay diferencias, informa y falla, sin reemplazar el histórico.
- `python verificar_datos.py`: verificar sin red los hashes, las agregaciones y los contratos.

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

El módulo [ml/](../../ml/README.md) ahora lee **las mismas series que la ficha** (`species_comparison_values`), incluida la lluvia seca. Se separan:

1. **2025:** predicción retrospectiva con entrenamiento hasta 2024, comparada con el dato NASA conocido; `hindcast_2025`.
2. **2026–2030:** extrapolación con el histórico completo hasta 2025; `forecast`.

Se compara regresión autorregresiva Ridge con persistencia, medias históricas/recientes, tendencia lineal y Sen. La selección usa validación temporal, no una división aleatoria. La selección de meses secos quedó fijada en 2014: su validación usa solo orígenes desde ese año, para evitar utilizar una definición futura en un experimento anterior.

En el test 2021–2025 la banda nominal del 80 % cubre aproximadamente el 64,2 % de los valores. Tiene cobertura insuficiente; es exploratoria. Las 133 series contienen lugares compartidos e indicadores relacionados y no son 133 experimentos independientes. Los pronósticos los produce el proyecto, **no NASA**, y no son probabilidades de supervivencia ni proyecciones de modelos climáticos con escenarios de emisiones.

Todavía no se implementa un modelo multivariable entre indicadores ni un modelo de supervivencia. Ampliar la ficha selecciona más series objetivo; eso, por sí solo, no convierte al predictor en multivariable. El siguiente experimento razonable sería comparar predictores mensuales con rezagos y estacionalidad contra referencias simples, conservando validación temporal y un período de prueba final separado.
