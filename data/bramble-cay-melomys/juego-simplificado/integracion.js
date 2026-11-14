// Ejemplo ES module. El equipo aporta sus funciones de dibujo y su estado de juego.
// Servir los JSON como recursos estáticos. No ejecutar fetch desde file://.
export function ficha(datos, sitio, variable) {
  const r = datos.records.find(r => r.site_id === sitio && r.variable === variable);
  if (!r) throw new Error('Sitio o variable no disponible');
  return {
    variacionMensual: r.monthly_points,
    tendenciaAnual: { observada: r.annual_points, sen: r.sen_line_points },
    unidadMensual: datos.variables[variable].monthly_unit,
    unidadAnual: datos.variables[variable].annual_unit,
    pendiente: { valor: r.slope_per_decade, unidad: r.slope_unit },
    tests: r.tests,
    detalles: r.advanced,
    interpretacion: r.trend_feedback
  };
}
export function resolverEleccion(retroalimentacion, sitio) {
  const respuesta = retroalimentacion.by_choice[sitio];
  if (!respuesta) throw new Error('Selecciona uno de los tres arriendos');
  return { ...respuesta, graficos: retroalimentacion.comparative_charts };
}
// Antes de decidir: ficha(decision2015, sitio, variable). El juego ocurre en 2015; el expediente llega hasta 2014.
// Tras confirmar: resolverEleccion(retroalimentacion, sitio).
// Dibujar sus tres graficos comparativos y mostrar titulo/mensaje.
// La revelacion 1981–2025 es una fase posterior y explícita, no la devolución de 2015.
