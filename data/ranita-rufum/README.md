# Arriendos de Rhinoderma rufum

El archivo clima-mensual.json contiene cuatro sitios y 550 meses por sitio (1981-01 a 2026-10). Cada fila tiene month, T2M (°C), RH2M (%) y PRECTOTCORR (mm/día). Para expresar lluvia acumulada del mes, multiplica PRECTOTCORR por los días del mes.

| ID | Coordenadas consultadas (latitud, longitud) | Papel en el juego |
| --- | --- | --- |
| concepcion | -36.82, -73.05 | Referencia regional aproximada de un registro histórico cerca de Concepción |
| otways | -38.67, 143.50 | Mejor análogo entre los tres arriendos de la simulación |
| calama | -22.46, -68.93 | Arriendo distractor por sequedad |
| singapur | 1.35, 103.81 | Arriendo distractor por temperatura alta respecto de la referencia |

La ficha del MMA documenta huevos sobre suelo húmedo, metamorfosis acuática y observaciones históricas cerca de vertientes protegidas por árboles. La humedad del aire y la lluvia son pistas indirectas. Para establecer la calidad de un hábitat hacen falta datos de suelo, bosque, aguas aptas para larvas y otros factores. La temperatura sirve para comparar climas templados, sin umbrales fisiológicos confirmados. POWER representa una grilla meteorológica regional, no una medición bajo el dosel o en el cauce.

Para el capítulo de 1981, muestra datos de 1981 o identifica la serie posterior como revelación. Los promedios de 1981–1990 sirven para comparar el clima regional retrospectivamente, no para establecer las condiciones previas a la desaparición. El veredicto de Otways es narrativo y expresa semejanza climática entre las opciones comparadas; la supervivencia y la causa de desaparición quedan indeterminadas.

Los ocho JSON individuales son respuestas originales de NASA POWER. El JSON consolidado excluye el agregado anual de la API mensual e incorpora 2026 como promedios de la serie diaria. Los valores recientes pueden revisarse. Para estimar tendencias, usa años completos hasta 2025 o compara la misma estación entre años.

Fuentes
- https://simbio.mma.gob.cl/Especies/VistaImpresion/12275
- https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
- https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/
- https://www.parks.vic.gov.au/get-into-nature/conservation-and-science/our-amazing-diversity/wet-forests-and-rainforest

## Evidencia para elegir el arriendo

Promedios de los 120 valores mensuales de enero de 1981 a diciembre de 1990. La lluvia se expresa como media de las tasas mensuales, en mm/día. El período permite una comparación retrospectiva con la misma cobertura en los cuatro sitios.

| Sitio | Temperatura a 2 m (°C) | Humedad relativa a 2 m (%) | Precipitación (mm/día) |
| --- | ---: | ---: | ---: |
| Concepción | 13,39 | 73,97 | 2,61 |
| Great Otway | 13,49 | 76,30 | 2,17 |
| Calama | 13,12 | 24,49 | 0,14 |
| Singapur | 26,73 | 83,49 | 5,52 |

Great Otway es la opción con menor diferencia absoluta respecto de Concepción en las tres variables resumidas. La ficha del arriendo puede destacar también sus quebradas sombreadas y su bosque templado húmedo. Calama sirve para mostrar que una temperatura similar puede coexistir con un clima mucho más seco. Singapur tiene humedad y lluvia abundantes junto con una temperatura media mucho mayor. La selección se limita a estos tres candidatos. El juego puede usar la serie completa para la revelación y mostrar la estacionalidad, los valores y sus tendencias por separado.

Para reproducir la tabla, filtra series por month entre 1981-01 y 1990-12, y calcula la media aritmética de cada columna. Los parámetros de consulta se reconstruyen con las coordenadas de la tabla original, los campos T2M,RH2M,PRECTOTCORR, community=AG y los rangos 1981–2025 (mensual) y enero–octubre de 2026 (diario).
