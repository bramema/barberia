BARBERÍA ROYAL
==============

Requisito: Node.js 14 o superior (https://nodejs.org). No hay que instalar nada más.

1) Abre una terminal en esta carpeta y ejecuta:
       node server.js
2) Abre en el navegador:
       Vista cliente:  http://localhost:3000
       Panel admin:    http://localhost:3000/admin.html

Las citas se guardan en  data/citas.json  (ordenadas por fecha y hora).
Los horarios se guardan en  data/config.json  (se crea la primera vez que el admin guarda un horario;
mientras no exista se usa lunes a sábado de 9:00 a 19:00).

HORARIOS (panel admin)
  - Horario de la barbería: hora de apertura, hora de cierre y días de atención.
  - Horario de cada barbero: hora de entrada, hora de salida y días de trabajo.
  Un turno se puede reservar solo si la barbería está abierta y al menos un barbero trabaja a esa hora.
  Si trabajan varios barberos a la misma hora, se aceptan tantas citas como barberos haya.
No abras los .html con doble clic: sin el servidor no se pueden guardar las citas.

Archivos
  index.html   vista cliente
  admin.html   panel de administración
  barbero.html panel del barbero
  css/styles.css     estilos compartidos
  script/horario.js  reglas de horario (las usan el servidor y las páginas)
  server.js    servidor que lee y escribe data/citas.json
  data/citas.json   base de datos de citas
