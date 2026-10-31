/* =============================================================
   Barbería Royal — Permisos de la tabla vacaciones_barberos
   Ejecutar en Supabase → SQL Editor después de horarios_barberos.sql
   (usa es_admin()). Se puede volver a ejecutar sin problema.

   La tabla ya existe: barbero_id → barberos.id, fecha_inicio, fecha_fin,
   motivo, estado ('pendiente' | 'aprobado'). Solo las aprobadas bloquean citas.
   ============================================================= */

-- Hoy la tabla no tiene políticas: el personal la consulta, solo el admin la gestiona
alter table vacaciones_barberos enable row level security;

drop policy if exists "personal vacaciones" on vacaciones_barberos;
create policy "personal vacaciones" on vacaciones_barberos
  for select to authenticated using (es_personal());

drop policy if exists "admin vacaciones" on vacaciones_barberos;
create policy "admin vacaciones" on vacaciones_barberos
  for all to authenticated using (es_admin()) with check (es_admin());
