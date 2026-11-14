# Datos del melomys listos para integrar

## Qué cargar

Los textos que ve el jugador (catálogo, retroalimentación, etiquetas, sellos y vista previa) están en inglés; los identificadores no cambiaron.

Los JSON son estáticos, UTF-8, sin valores NaN ni dependencias de Python en el juego. Copiar esta carpeta a los recursos públicos de la aplicación. Los identificadores coinciden con `clima-mensual.json`: `bramble-cay`, `erub`, `funafuti`, `alice-springs`.

| Archivo | Contenido | Uso |
|---|---|---|
| `tendencias.json` | 24 registros: 4 sitios × 3 variables × 2 períodos | Pendiente, p, significancia y sello junto al gráfico |
| `series-anuales.json` | 180 registros: 45 años × 4 sitios | Gráficos de evolución; filtrar el período |
| `ciclo-mensual.json` | 48 registros: 12 meses × 4 sitios; promedios 1981–2014 | Comparación estacional y meses secos |
| `fuentes-analisis.json` | Consultas NASA, archivos originales, SHA-256 y referencias | Créditos y trazabilidad |
| `RESULTADOS.md` | Tablas de ambos períodos y semejanza estacional | Lectura para el equipo |
| `figuras/` | Tres PNG | Referencias visuales o imágenes listas para mostrar |

## Evitar datos futuros en el expediente

- **Decisión en 2015:** `period_id === "decision_2015"`, series anuales hasta 2014, ciclos mensuales 1981–2014. El juego ocurre en 2015.
- **Revelación:** `period_id === "revelacion"`, series hasta 2025. Es un análisis retrospectivo de 1981–2025, no una predicción hecha en 2015.
- El archivo mensual previo contiene 2026 parcial. No usar esos meses para calcular un total anual comparable. Tampoco mostrar el archivo completo antes de la revelación.
- Las fuentes históricas publicadas después de 2015 son documentación de los autores/revelación; no presentarlas como documentos que la jugadora tenía en 2015. Incluso las series anteriores a 2015 son una reconstrucción actual, no una copia de datos publicados entonces.

Ejemplo JavaScript (ajustar la ruta al directorio público del juego):

```js
const base = '/data/bramble-cay-melomys';
async function cargar(nombre) {
  const response = await fetch(`${base}/${nombre}.json`);
  if (!response.ok) throw new Error(`No se pudo cargar ${nombre}`);
  return response.json();
}
const [tendencias, anuales, ciclos] = await Promise.all([
  cargar('tendencias'), cargar('series-anuales'), cargar('ciclo-mensual')
]);
const periodo = 'decision_2015'; // cambiar solo al desbloquear la revelación
const sitio = 'erub';
const variable = 'PRECTOTCORR';
const resultado = tendencias.records.find(r =>
  r.site_id === sitio && r.variable === variable && r.period_id === periodo
);
const puntos = anuales.records
  .filter(r => r.site_id === sitio && r.year >= resultado.start_year && r.year <= resultado.end_year)
  .map(r => ({ x: r.year, y: r[variable] }));
const tarjeta = {
  periodo: `${resultado.start_year}–${resultado.end_year}`,
  pendiente: `${resultado.sen_slope_per_decade.toFixed(1)} ${resultado.slope_unit}`,
  sello: resultado.game_stamp,
  p: resultado.p_value_holm,
  fuente: 'NASA POWER · análisis del equipo'
};
const meses = ciclos.records.filter(r => r.site_id === sitio);
// Gráfico de lluvia mensual: meses.map(r => ({x:r.month, y:r.precipitation_mm_month})).
```

## Unidades y campos

`T2M` es temperatura del aire a 2 m; `RH2M`, humedad relativa a 2 m. No es humedad del suelo. `PRECTOTCORR` conserva el identificador NASA, pero su unidad depende del archivo:

- `clima-mensual.json` y `ciclo-mensual.json`: mm/día. El segundo agrega `precipitation_mm_month` en mm/mes para graficar acumulados típicos.
- `series-anuales.json`: mm/año. No volver a multiplicarlo por días.
- `sen_slope_per_decade`: cambio de la variable anual por década. Para lluvia, `(mm/year)/decade`; para temperatura, `°C/decade`; para humedad, `percentage points/decade` (los textos de unidades y etiquetas para el jugador están en inglés).
- `trend_change_over_period`: pendiente anual × (último año − primer año), en la unidad anual. Es el cambio del ajuste, no la resta de dos observaciones.
- `observed_last_minus_first`: resta observada del último y primer año. Es más sensible a años extremos.
- `sen_line_at_first_year`: valor del ajuste al inicio; línea = este valor + pendiente por década / 10 × (año − inicio).
- `p_value`: Mann–Kendall con corrección de autocorrelación. `significant_005`: p < 0,05.
- `p_value_holm` y `significant_holm_005`: además consideran 12 contrastes (4 sitios × 3 variables) dentro del mismo período.
- `game_stamp` usa Holm: `REAL ↑`, `REAL ↓` o `NOT PROVEN`. Estos son nombres de sellos del juego; en texto explicativo, decir «evidencia estadística de aumento/descenso» y evitar afirmar certeza.
- `significance_sensitive_to_lag_choice`: la decisión p < 0,05 sin Holm cambia si se limita la corrección a 1 o 3 rezagos. Mostrar una nota de sensibilidad si es `true`.

`NOT PROVEN` significa evidencia insuficiente con este test, período y criterio. No significa clima estable, riesgo cero ni ausencia de cambio. Un p de 0,02 no es una probabilidad de supervivencia ni una probabilidad de que la tendencia sea verdadera.

## Interpretación para diseñar la ronda

**Erub sigue siendo el candidato más parecido en el ciclo de 12 meses y en los seis meses secos de referencia, en las tres variables.** Su RMSE mensual frente a Bramble Cay es 0,140 °C, 0,612 puntos de humedad y 0,499 mm/día. La semejanza regional no equivale a hábitat validado.

Para una comparación reproducible, definimos la estación seca como los seis meses con menor lluvia diaria media de Bramble Cay en 1981–2014: **junio–noviembre**. Se comparan los mismos meses en los cuatro sitios. Es una definición operativa para esta demo, no un umbral ecológico ni una definición meteorológica oficial. Bramble Cay acumula 426,8 mm en esos meses; Erub 338,3 mm (aproximadamente 21 % menos); Funafuti 1.064,4 mm; Alice Springs 95,7 mm. Por eso «más parecido» no debe mostrarse como «idéntico».

**En la revelación 1981–2025**, la pendiente de lluvia es negativa en los cuatro sitios. Bramble Cay (−262,6), Erub (−194,1) y Funafuti (−146,0 mm/año por década) tienen p < 0,05 con Hamed–Rao, pero solo Funafuti mantiene esa significancia al corregir las 12 comparaciones con Holm. Alice Springs (−17,3) no alcanza p < 0,05. Para temperatura, Bramble Cay, Erub y Funafuti mantienen evidencia de aumento después de Holm; Alice Springs queda `NOT PROVEN` bajo ese criterio. No convertir la disminución de lluvia en la causa demostrada de la extinción: el informe australiano aporta evidencia sobre inundación marina y pérdida de vegetación.

**En el expediente 1981–2014**, el aumento de temperatura conserva significancia tras Holm en Bramble Cay, Erub y Funafuti (+0,17 a +0,18 °C/década); Alice Springs queda `NOT PROVEN`. En lluvia, solo Funafuti muestra evidencia de descenso tras Holm (−177,6 mm/año por década); Bramble Cay (−50,0) y Erub (−18,5) quedan `NOT PROVEN`. Ninguna humedad supera Holm. El caso enseña que semejanza del clima y tendencia temporal son preguntas distintas: que Erub se esté calentando igual que Bramble Cay no lo descarta como análogo, y una tendencia significativa no indica por sí sola qué arriendo elegir.

## Regla explícita de la demo

1. Comparar el ciclo del clima con Bramble Cay, incluyendo los meses secos.
2. Revisar si el arriendo ficticio ofrece terreno interior elevado y vegetación herbácea apropiada.
3. Entre las tres fichas de esta demo, preferir **Erub, terreno interior elevado**. Funafuti representa un arriendo ficticio en atolón bajo; Alice Springs presenta un clima mucho más seco y de mayor contraste térmico.

Separar en la ficha «dato» de «supuesto del juego»: NASA proporciona clima regional; el plan de Erub acredita la existencia de terreno elevado, pero la elevación exacta y vegetación de nuestro arriendo no están medidas. Los 181 m corresponden a la cumbre de la isla, no al arriendo. No asignar una altura numérica inventada como observación. La supervivencia o mortalidad de una población reubicada es un resultado de la simulación; estos datos no entrenan ni validan un modelo de supervivencia.

## Método, reproducibilidad y límites

Desde la raíz del repositorio, con Python 3.12 y un entorno virtual:

```sh
python -m pip install -r scripts/requirements-analysis.txt
python scripts/analizar_melomys.py
python scripts/verificar_melomys.py
```

Se usan exclusivamente las cuatro respuestas mensuales NASA POWER archivadas en `nasa-power/`, años 1981–2025, cuyos encabezados indican MERRA2/POWER. No hace falta red para repetir el análisis. Se ignoran las claves NASA de resumen anual (mes 13). Los hashes y las consultas para una descarga nueva están en `fuentes-analisis.json`; una nueva descarga puede revisarse y producir otros resultados. La fecha del manifiesto es la del análisis; no se inventa una fecha de descarga.

Lluvia anual = suma de la tasa mensual × días reales de cada mes (incluidos bisiestos). Temperatura y humedad anual = promedio mensual ponderado por días. Esto difiere ligeramente del promedio simple de meses del README anterior. Se exigen 12 meses válidos por año, sin interpolar, rellenar ni descartar años extremos. Los 4 × 45 años están completos.

Pendiente de Sen sobre series anuales. Mann–Kendall bilateral, corrección de empates y continuidad, con varianza Hamed–Rao: se quita la tendencia de Sen, se calculan autocorrelaciones de los rangos y se consideran los rezagos 1 a n−1 que exceden ±1,96/√n. Se guardan factor de varianza, rezagos seleccionados y resultados alternativos con máximo 1 y 3 rezagos. El factor puede ser menor que 1 si predominan autocorrelaciones negativas. No se eligió el método para conseguir p pequeños. Holm controla el error familiar de 12 contrastes por período; no requiere independencia entre sitios. No se combinan ambos períodos como si fueran muestras independientes.

Las series anuales evitan tratar 12 meses estacionales como observaciones independientes. La corrección sigue siendo aproximada, especialmente con 34 años; no resuelve por sí sola cambios estructurales, revisiones del reanálisis ni toda persistencia de largo plazo. No se han hecho pruebas de homogeneidad ni atribución causal. Las pendientes son retrospectivas y no deben extrapolarse como pronóstico. Las cifras provienen de estimaciones de grilla regional, no de estaciones instaladas en cada parcela. La proximidad de Bramble Cay y Erub también implica dependencia espacial.

La pendiente se verifica contra SciPy y el factor de varianza contra un cálculo separado. Las verificaciones adicionales cubren fechas, unidades, bisiestos, agregaciones, consistencia con el JSON mensual previo, hashes y sellos. No se entregan intervalos de confianza convencionales de Sen como si estuvieran corregidos por autocorrelación.

## Evidencia local pendiente y fuentes

- [NASA POWER: metodología meteorológica](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/). Las consultas exactas por sitio y los archivos fuente están en el manifiesto.
- [Hamed y Rao (1998)](https://doi.org/10.1016/S0022-1694(97)00125-X), corrección de autocorrelación; [implementación pyMannKendall](https://github.com/mmhs013/pyMannKendall).
- [Evaluación australiana del melomys](https://www.dcceew.gov.au/sites/default/files/env/consultations/d678432e-1ee8-4316-b1ef-af29634401d7/files/consultation-document-bramble-cay-melomys-2018.pdf): evidencia histórica de inundación y pérdida de vegetación.
- [Plan de Erub, p. 294](https://tsirc.qld.gov.au/wp-content/uploads/2024/11/Part-7-Erub-Darnley-Island-local-plan-code.pdf): terreno elevado detrás del poblado, zonas costeras inundables y cumbre de 181 m. Un sitio real exige coordenadas de parcela, elevación con datum vertical conocido, vegetación/alimento/refugio y exposición a marejadas y oleaje.
- [BOM: nivel observado mensual](https://www.bom.gov.au/oceanography/projects/ntc/monthly/index.shtml), incluye Thursday Island; [PSMSL, estación 1570](https://psmsl.org/data/obtaining/stations/1570.php), posible referencia regional. PSMSL informa 1983–2024, 68 % de cobertura, categoría métrica sin calidad de investigación y problemas de datum. Es un candidato para evaluación futura, **no una tendencia local validada incorporada a la demo**. No unir registros de instrumentos/datum diferentes sin revisión.
- `nivel-del-mar-global.json` sigue disponible como contexto global NASA, con sus fuentes en el README. No se convierte a nivel local ni se usa como altura de inundación del arriendo. Esta entrega calcula tendencias meteorológicas; no agrega una tendencia marina regional sin validar.

## Archivo de especies y secuencia de expedientes

Cargar [catalogo-especies.json](catalogo-especies.json) para poblar el Archivo de especies. Cada entrada enlaza los datos de decisión, retroalimentación, revelación y fuentes. Las rutas se resuelven respecto de la URL del catálogo. El orden de chapters es el orden narrativo. Mostrar claim y la evidencia solicitada. Mostrar answer después del sello del jugador. El catálogo incluye respuestas de la demo y se sirve al cliente.

El catálogo referencia los JSON existentes. Para los gráficos y Mann–Kendall, usar ficha() de juego-simplificado/integracion.js con el sitio y variable solicitados. La comparación estacional usa comparative_charts del paquete de retroalimentación, filtrando por los sitios y la variable del expediente. Mostrar entonces únicamente las curvas. Después de elegir un arriendo, usar resolverEleccion() para devolver el resultado. Abrir la revelación 1981–2025 en una fase posterior.
