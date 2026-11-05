/* =============================================================
   Barbería Royal — CRUD de servicios desde el panel admin
   Ejecutar en Supabase → SQL Editor después de horarios_barberos.sql
   (usa es_admin()). Se puede volver a ejecutar sin problema.

   - Cualquiera sigue viendo los servicios activos (página de reservas).
   - El personal (admin y barbero) puede leer todos los servicios.
   - Solo el administrador puede crear, editar o eliminar servicios.
   ============================================================= */

drop policy if exists "personal servicios" on servicios;
create policy "personal servicios" on servicios
  for select to authenticated using (es_personal());

drop policy if exists "admin servicios" on servicios;
create policy "admin servicios" on servicios
  for all to authenticated using (es_admin()) with check (es_admin());

/* ---------- Validaciones en la base de datos ----------
   "not valid": no revisa los servicios que ya existen, solo los nuevos y los que se editen. */
alter table servicios drop constraint if exists servicios_nombre_valido;
alter table servicios add constraint servicios_nombre_valido
  check (length(trim(nombre)) between 3 and 60) not valid;

alter table servicios drop constraint if exists servicios_precio_valido;
alter table servicios add constraint servicios_precio_valido
  check (precio >= 0 and precio <= 10000000) not valid;

alter table servicios drop constraint if exists servicios_duracion_valida;
alter table servicios add constraint servicios_duracion_valida
  check (duracion_minutos between 5 and 240) not valid;
