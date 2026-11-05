/* =============================================================
   Barbería Royal — Icono de cada servicio
   Ejecutar en Supabase → SQL Editor. Se puede volver a ejecutar sin problema.

   El admin elige el icono al crear o editar un servicio. Se guarda su nombre
   (p. ej. 'scissors', 'razor'); la lista de iconos disponibles está en js/iconos.js.
   Si un servicio no tiene icono, la página muestra las tijeras.
   ============================================================= */

alter table servicios add column if not exists icono text;

-- Solo nombres cortos en minúsculas (los dibujos viven en js/iconos.js)
alter table servicios drop constraint if exists servicios_icono_valido;
alter table servicios add constraint servicios_icono_valido
  check (icono is null or icono ~ '^[a-z]{2,20}$');

-- Los servicios que ya existían reciben el icono que les correspondía por su nombre
update servicios s set icono = v.icono
from (values
  ('Corte clásico',     'scissors'),
  ('Corte degradado',   'comb'),
  ('Arreglo de barba',  'mustache'),
  ('Barba y perfilado', 'mustache'),
  ('Corte y barba',     'pole'),
  ('Corte + Barba',     'pole'),
  ('Afeitado clásico',  'razor'),
  ('Afeitado a navaja', 'razor'),
  ('Limpieza facial',   'face'),
  ('Experiencia Royal', 'crown')
) as v(nombre, icono)
where s.nombre = v.nombre and s.icono is null;
