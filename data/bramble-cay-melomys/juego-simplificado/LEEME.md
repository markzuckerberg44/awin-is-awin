# Pantalla breve y devolución al estudiante

Paquete aprobado para integrar al juego. Conserva el análisis completo en el directorio padre.

## Antes de elegir: dos gráficos, una variable a la vez

Selector de arriendo y de variable (temperatura, humedad, lluvia). Mantener Bramble Cay como referencia accesible, con los mismos ejes y período que el candidato. No usar escalas verticales distintas para hacer parecer iguales dos lugares.

1. **Variación y estacionalidad:** serie mensual. X = fecha, Y = temperatura °C, humedad % o precipitación acumulada mm/mes. `monthly_points` ya contiene la conversión de lluvia; no multiplicar otra vez por días.
2. **Tendencia:** serie anual y línea de Sen. X = año, Y = media anual °C/% o total mm/año. Usar `annual_points` y `sen_line_points`; no ajustar otra recta con regresión lineal.

Mostrar debajo la pendiente con su unidad y dos valores p. El juego ocurre en 2015: el clima histórico del expediente es 1981–2014; las figuras de ejemplo hasta 2025 corresponden a una revelación posterior.

## Qué dos tests mostrar

| Tarjeta | Pregunta | Interpretación |
|---|---|---|
| Mann–Kendall original | ¿Hay tendencia si suponemos años independientes? | Comparación didáctica; puede verse afectada por autocorrelación. |
| Mann–Kendall corregido, Hamed–Rao | ¿Qué evidencia hay al considerar la dependencia temporal? | Resultado principal para estudiar tendencia. |

Ambos contrastan ausencia de tendencia monotónica; son dos versiones del mismo test, no comprobaciones independientes. Comparar sus p tiene sentido para enseñar el efecto de los supuestos. No agregar ADF/KPSS/Ljung–Box a esta pantalla: pertenecen a la exploración para modelar pronósticos.

Sen aparece como magnitud del cambio, no como test con p. El p no indica similitud con Bramble Cay ni probabilidad de supervivencia. No escoger el lugar con menor p.

**Criterio de presentación:** las dos tarjetas muestran p sin ajuste por comparaciones múltiples y su lectura individual al 5 %. No mostrar junto a ellas un sello sin explicar su criterio. Si se conserva el sello `REAL ↑/↓` o `NOT PROVEN` del paquete anterior, mostrarlo en «Ver detalles» junto a `p_holm` y la nota «corrige las 12 comparaciones». No recalcular Holm solo con los lugares visibles. Así, un p individual menor de 0,05 y un sello NOT PROVEN no se presentan como una contradicción inexplicada.

Redondear solo para mostrar. Si p < 0,001, escribir «p < 0,001», nunca «p = 0». La corrección no necesariamente aumenta el p; según la autocorrelación, puede disminuirlo o dejarlo igual. El campo `sensitive_to_lags` activa una nota en los detalles si cambia la conclusión según los rezagos.

## Después de confirmar: retroalimentación comparativa

Mostrar el resultado de `resolverEleccion()` de `integracion.js`. La devolución contiene tres curvas comparativas de 12 meses típicos: una por variable, las cuatro localidades en cada gráfico. Destacar Bramble Cay y la selección; tras una opción incorrecta, destacar también Erub. Mantener colores consistentes entre vistas y sombrear junio–noviembre, los seis meses más secos de Bramble Cay según nuestra definición operativa.

La elección correcta de la simulación es **Erub, terreno interior elevado con vegetación**. No basta con un p ni con la pendiente: evaluar semejanza del clima y la ficha de exposición/vegetación. No asignar una altura real al arriendo: los 181 m del plan municipal describen la cumbre de la isla. La vegetación apropiada y ubicación de la parcela son supuestos de la demo.

Texto principal al acertar:

> Elegiste la opción más adecuada para esta simulación. Erub conserva el ciclo climático más parecido a Bramble Cay. Sin embargo, recibe aproximadamente 22 % menos lluvia durante los meses secos. El terreno interior elevado del arriendo ficticio responde al riesgo de inundación marina. La semejanza climática no garantiza supervivencia.

Debajo de los gráficos, dos mensajes breves: «Cycles let you compare the climate» y «Trends show how much it changes over the years». La tendencia y sus p de 1981–2025 se desbloquean en otra fase; no usar resultados futuros para justificar la decisión de 2015.

También hay devolución específica para Funafuti y Alice Springs, sin bloquear al estudiante sin explicación.

## Archivos y contrato

- `decision_2015.json`: 12 fichas (4 sitios × 3 variables), cada una con 408 puntos mensuales, 34 anuales y 34 del ajuste de Sen, pendiente y dos tests.
- `revelacion.json`: las mismas fichas con 540 meses y 45 años hasta 2025.
- `retroalimentacion.json`: respuestas para las tres elecciones, criterio, unidades y 12 curvas comparativas (4 sitios × 3 variables) de 12 puntos cada una, 1981–2014.
- `fuentes.json`: NASA POWER, archivos fuente con hashes, consultas, metodología y evidencia local.
- `integracion.js`: funciones para convertir los JSON en las vistas y resolver la elección. El equipo usa su biblioteca de gráficos; no necesita PNG ni Python en el juego.
- `preparar.py`: generación desde el repositorio local. No recalcula ni selecciona tests según su p; conserva los resultados previamente verificados.

Abrir `vista-previa.html` en un navegador para probar las selecciones. Para regenerar los datos: `python preparar.py`; para regenerar la vista: `python crear_vista.py`, desde este directorio. La vista es un ejemplo de integración; no está conectada al juego final.
