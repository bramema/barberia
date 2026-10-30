/* =============================================================
   BARBERÍA ROYAL — Reglas de horario (compartido)
   Lo usan el servidor (require) y las páginas (window.Horario),
   así las reglas de horario viven en un solo sitio.

   Días: 0 = domingo, 1 = lunes ... 6 = sábado (igual que Date.getDay()).
   Las horas van en pasos de 30 minutos ("09:00", "09:30", ...).
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Horario = factory();
})(this, function () {
  'use strict';

  var PASO = 30; // minutos entre turnos
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS_CORTOS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
  var ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza el lunes

  var DEFAULT = {
    horario: { apertura: '09:00', cierre: '19:00', dias: [1, 2, 3, 4, 5, 6] },
    barberos: [
      { usuario: 'barbero1', nombre: 'Carlos', inicio: '09:00', fin: '19:00', dias: [1, 2, 3, 4, 5, 6] }
    ]
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function esHora(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):(00|30)$/.test(s); }
  function aMin(s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; }
  function aHora(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function bonita(s) { return String(+s.split(':')[0]) + ':' + s.split(':')[1]; } // "09:00" -> "9:00"

  /* Todas las horas posibles para los selectores (05:00 a 23:30). */
  function opcionesHora() {
    var out = [];
    for (var m = 5 * 60; m < 24 * 60; m += PASO) out.push(aHora(m));
    return out;
  }

  function diasValidos(d) {
    return Array.isArray(d) && d.length <= 7 &&
      d.every(function (x, i) { return Number.isInteger(x) && x >= 0 && x <= 6 && d.indexOf(x) === i; });
  }

  /* Devuelve un mensaje de error o null si el rango es válido. */
  function validarRango(desde, hasta, dias) {
    if (!esHora(desde) || !esHora(hasta)) return 'Las horas deben ser en punto o y media (ej. 09:00, 09:30).';
    if (aMin(desde) >= aMin(hasta)) return 'La hora de inicio debe ser antes de la hora de fin.';
    if (!diasValidos(dias)) return 'Los días no son válidos.';
    return null;
  }

  /* Cuántos barberos atienden ese día de la semana a esa hora (dentro del horario de la barbería). */
  function capacidad(cfg, diaSemana, hora) {
    var h = cfg.horario, t = aMin(hora);
    if (h.dias.indexOf(diaSemana) === -1) return 0;
    if (t < aMin(h.apertura) || t + PASO > aMin(h.cierre)) return 0;
    return cfg.barberos.filter(function (b) {
      return b.dias.indexOf(diaSemana) !== -1 && t >= aMin(b.inicio) && t + PASO <= aMin(b.fin);
    }).length;
  }

  /* Turnos en los que hay al menos un barbero disponible. */
  function turnosDelDia(cfg, diaSemana) {
    var out = [], h = cfg.horario;
    for (var m = aMin(h.apertura); m + PASO <= aMin(h.cierre); m += PASO) {
      var t = aHora(m);
      if (capacidad(cfg, diaSemana, t) > 0) out.push(t);
    }
    return out;
  }

  function diaAbierto(cfg, diaSemana) { return turnosDelDia(cfg, diaSemana).length > 0; }

  /* "de lunes a sábado", "lunes, miércoles y viernes", "todos los días" */
  function textoDias(dias) {
    var orden = ORDEN_SEMANA.filter(function (d) { return dias.indexOf(d) !== -1; });
    if (!orden.length) return 'ningún día';
    if (orden.length === 7) return 'todos los días';
    var pos = orden.map(function (d) { return ORDEN_SEMANA.indexOf(d); });
    var seguidos = pos.every(function (p, i) { return i === 0 || p === pos[i - 1] + 1; });
    if (seguidos && orden.length >= 3) return 'de ' + DIAS[orden[0]] + ' a ' + DIAS[orden[orden.length - 1]];
    var n = orden.map(function (d) { return DIAS[d]; });
    return n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1];
  }

  function textoRango(desde, hasta) { return bonita(desde) + ' a ' + bonita(hasta); }

  return {
    PASO: PASO, DIAS: DIAS, DIAS_CORTOS: DIAS_CORTOS, ORDEN_SEMANA: ORDEN_SEMANA, DEFAULT: DEFAULT,
    esHora: esHora, aMin: aMin, opcionesHora: opcionesHora, validarRango: validarRango,
    capacidad: capacidad, turnosDelDia: turnosDelDia, diaAbierto: diaAbierto,
    textoDias: textoDias, textoRango: textoRango, bonita: bonita
  };
});
