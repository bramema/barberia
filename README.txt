BARBERÍA ROYAL
==============

Requisito: Node.js 14 o superior (https://nodejs.org). No hay que instalar nada más.

1) Abre una terminal en esta carpeta y ejecuta:
       node server.js
2) Abre en el navegador:
       Vista cliente:  http://localhost:3000
       Panel admin:    http://localhost:3000/admin.html

Las citas se guardan en  data/citas.json  (ordenadas por fecha y hora).
No abras los .html con doble clic: sin el servidor no se pueden guardar las citas.

Archivos
  index.html   vista cliente
  admin.html   panel de administración
  styles.css   estilos compartidos
  server.js    servidor que lee y escribe data/citas.json
  data/citas.json   base de datos de citas
