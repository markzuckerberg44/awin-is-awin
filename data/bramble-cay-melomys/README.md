# Melomys de Bramble Cay

## Entrega de análisis e integración

Ver [GUIA-INTEGRACION.md](GUIA-INTEGRACION.md) para el contrato de los JSON, código JavaScript de ejemplo, regla de decisión, interpretación, metodología y fuentes. Las [tablas calculadas](RESULTADOS.md) incluyen pendientes de Sen y Mann–Kendall con corrección de autocorrelación para 1981–2008 y 1981–2025.

- [tendencias.json](tendencias.json): pendiente por década, significancia y sellos del juego para 4 sitios × 3 variables × 2 períodos.
- [series-anuales.json](series-anuales.json): 45 años completos por sitio, lluvia en mm/año y medias ponderadas por días.
- [ciclo-mensual.json](ciclo-mensual.json): los 12 meses típicos de 1981–2008, comparación de la estación seca y semejanza regional.
- [fuentes-analisis.json](fuentes-analisis.json): consultas NASA, referencias y hashes de los datos originales.
- [Ciclos mensuales](figuras/ciclo-mensual.png), [tendencias para la decisión](figuras/tendencias-decision_2009.png) y [tendencias para la revelación](figuras/tendencias-revelacion.png).

Reproducir con `python scripts/analizar_melomys.py` desde la raíz; dependencias en `scripts/requirements-analysis.txt`. Validar con `python scripts/verificar_melomys.py`. Erub es el más semejante también estacionalmente, aunque su lluvia de junio–noviembre es aproximadamente 22 % menor que la de Bramble Cay. Los sellos usan corrección de Holm para las 12 comparaciones de cada período; `NO PROBADO` no significa ausencia de cambio.

El melomys de Bramble Cay (*Melomys rubicola*) ocupaba un cayo bajo del estrecho de Torres. Dependía de la vegetación herbácea para alimento y refugio. La evaluación australiana identifica la inundación marina recurrente como la explicación principal de la pérdida de vegetación y del declive. Para el juego, 2009 corresponde al último avistamiento reportado. La declaración federal de extinción fue en 2019.

## Comparación de los arriendos

Medias de 336 valores mensuales de NASA POWER entre enero de 1981 y diciembre de 2008. Se usa el mismo período para las cuatro localizaciones, anterior al año del escenario.

| Punto | Latitud, longitud | Temperatura a 2 m (°C) | Humedad relativa a 2 m (%) | Precipitación (mm/día) |
| --- | --- | ---: | ---: | ---: |
| Bramble Cay | -9.142, 143.877 | 26,80 | 82,39 | 5,60 |
| Erub | -9.589, 143.771 | 26,68 | 82,77 | 5,08 |
| Funafuti | -8.524, 179.195 | 28,07 | 80,39 | 7,40 |
| Alice Springs | -23.698, 133.880 | 21,80 | 35,68 | 0,81 |

**Arriendo preferido en la simulación.** Un terreno interior elevado en Erub. Entre los candidatos, Erub tiene la menor diferencia absoluta frente a Bramble Cay en cada una de las tres medias. El municipio describe Erub como una isla volcánica con una cumbre central de 181 m. La cumbre describe el relieve de la isla y la ubicación específica del arriendo es ficticia. El juego supone un terreno con cobertura herbácea. La disponibilidad de alimento, refugio y hábitat adecuado para el melomys allí queda sin validar.

**Distractores.** Funafuti comparte un clima cálido y húmedo y ofrece un arriendo ficticio en un atolón bajo expuesto al agua marina. Alice Springs ofrece un ambiente interior, considerablemente más seco. El criterio combina semejanza meteorológica regional, cobertura vegetal necesaria y exposición a inundación. Los valores se usan como evidencia comparativa; no se conocen umbrales fisiológicos a partir de estas fuentes.

## Archivos para el juego

- clima-mensual.json tiene 550 meses por sitio entre 1981-01 y 2026-10. Cada fila incluye T2M (°C), RH2M (%) y PRECTOTCORR (mm/día). Para convertir la lluvia media del mes a acumulado, multiplica por los días del mes.
- nasa-power/ contiene las respuestas originales. Para reproducir las consultas, usa el servicio mensual /api/temporal/monthly/point con start=1981 y end=2025, y el diario /api/temporal/daily/point con start=20260101 y end=20261031. Usa las coordenadas de cada archivo, parameters=T2M,RH2M,PRECTOTCORR, community=AG y format=JSON. Los meses de 2026 son promedios de la serie diaria y pueden revisarse. La grilla meteorológica caracteriza la zona regional, con resolución insuficiente para medir el microclima del terreno.
- nivel-del-mar-global.json contiene 1.093 observaciones de altimetría satelital global de 1993 a 2022, extraídas de la hoja Derived Data Set de NASA. La variación se expresa en mm y la fecha en año decimal. La serie muestra un aumento neto de 100,85 mm respecto del primer valor de 1993. Este indicador da contexto global. La inundación local requiere evidencia de mareas, oleaje, tormentas, relieve y nivel relativo del mar.
- Para la decisión ambientada en 2009, muestra la comparación 1981–2008; los datos posteriores sirven para la revelación. La elección de Erub es un veredicto del juego. La supervivencia real permanece indeterminada.

## Fuentes

- [Plan de recuperación australiano](https://www.dcceew.gov.au/sites/default/files/documents/bramble-cay-melomys.pdf)
- [Evaluación australiana de la extinción](https://www.dcceew.gov.au/sites/default/files/env/consultations/d678432e-1ee8-4316-b1ef-af29634401d7/files/consultation-document-bramble-cay-melomys-2018.pdf)
- [Australian Museum](https://australian.museum/learn/australia-over-time/extinct-animals/melomys-rubicola/)
- [NASA POWER](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/)
- [Nivel medio global del mar, NASA](https://www.nasa.gov/stem-content/sea-level-height-data-set/)
- [Plan municipal de Erub](https://tsirc.qld.gov.au/wp-content/uploads/2024/11/Part-7-Erub-Darnley-Island-local-plan-code.pdf)
- [Evaluación de amenazas climáticas de Tuvalu](https://www.tuvaluclimatechange.gov.tv/sites/default/files/2025-07/Tuvalu_Assessment%20of%20Climate%20Hazards%20Technical%20Report_final.pdf)
