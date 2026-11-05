/* =============================================================
   Barbería Royal — Vacaciones de los barberos
   Ejecutar en Supabase → SQL Editor después de horarios_barberos.sql
   (usa es_admin()). Se puede volver a ejecutar sin problema.

   La tabla ya existe: barbero_id → barberos.id, fecha_inicio, fecha_fin,
   motivo, estado. Solo las aprobadas bloquean citas.
     - barbero → pide vacaciones con solicitar_vacaciones() (quedan 'pendiente'),
                 ve sus solicitudes y puede retirar las que siguen pendientes.
     - admin   → las aprueba, las rechaza o las edita.
   estado: 'pendiente' | 'aprobado' | 'rechazado'
   ============================================================= */

-- barbero_id del usuario en sesión (null si no es un barbero enlazado). También está en citas_por_barbero.sql
create or replace function mi_barbero_id() returns bigint
language sql stable security definer set search_path = public as $$
  select barbero_id from perfiles where id = auth.uid() and rol = 'barbero'
$$;

/* ---------- Nuevo estado 'rechazado' ----------
   Si "estado" es un enum se le agrega el valor; si es texto se reemplaza su restricción.
*/
do $$
declare
  v_tipo regtype;
  c record;
begin
  select atttypid::regtype into v_tipo from pg_attribute
  where attrelid = 'vacaciones_barberos'::regclass and attname = 'estado';

  if exists (select 1 from pg_type where oid = v_tipo and typtype = 'e') then
    execute format('alter type %s add value if not exists %L', v_tipo, 'rechazado');
  else
    for c in select conname from pg_constraint
             where conrelid = 'vacaciones_barberos'::regclass and contype = 'c'
               and pg_get_constraintdef(oid) ilike '%estado%'
    loop
      execute format('alter table vacaciones_barberos drop constraint %I', c.conname);
    end loop;
    alter table vacaciones_barberos add constraint vacaciones_estado_valido
      check (estado in ('pendiente', 'aprobado', 'rechazado'));
  end if;
end $$;

/* ---------- Permisos ---------- */
alter table vacaciones_barberos enable row level security;

-- Antes todo el personal veía las vacaciones de todos: ahora el barbero solo ve las suyas
drop policy if exists "personal vacaciones" on vacaciones_barberos;

drop policy if exists "admin vacaciones" on vacaciones_barberos;
create policy "admin vacaciones" on vacaciones_barberos
  for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists "barbero ve sus vacaciones" on vacaciones_barberos;
create policy "barbero ve sus vacaciones" on vacaciones_barberos
  for select to authenticated using (barbero_id = mi_barbero_id());

-- Puede retirar una solicitud mientras el admin no la haya resuelto
drop policy if exists "barbero retira sus solicitudes" on vacaciones_barberos;
create policy "barbero retira sus solicitudes" on vacaciones_barberos
  for delete to authenticated using (barbero_id = mi_barbero_id() and estado = 'pendiente');

/* ---------- El barbero pide vacaciones ----------
   No inserta en la tabla directamente: así el estado siempre es 'pendiente'
   y el barbero_id es el suyo.
*/
create or replace function solicitar_vacaciones(p_inicio date, p_fin date, p_motivo text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_barbero bigint := mi_barbero_id();
  v_id bigint;
begin
  if v_barbero is null then raise exception 'Tu cuenta no está enlazada a ningún barbero.'; end if;

  p_motivo := nullif(regexp_replace(trim(coalesce(p_motivo, '')), '\s+', ' ', 'g'), '');
  if length(p_motivo) > 120 then raise exception 'El motivo no puede pasar de 120 caracteres.'; end if;

  -- current_date está en UTC: se acepta un día de margen por la zona horaria
  if p_inicio is null or p_fin is null or p_inicio < current_date - 1 or p_inicio > current_date + 365 then
    raise exception 'La fecha de inicio no es válida.';
  end if;
  if p_fin < p_inicio then raise exception 'La fecha final debe ser igual o posterior a la de inicio.'; end if;
  if p_fin > p_inicio + 60 then raise exception 'Una solicitud no puede pasar de 60 días.'; end if;

  if exists (
    select 1 from vacaciones_barberos v
    where v.barbero_id = v_barbero and v.estado in ('pendiente', 'aprobado')
      and v.fecha_inicio <= p_fin and p_inicio <= v.fecha_fin
  ) then
    raise exception 'Ya tienes vacaciones pedidas o aprobadas en esas fechas.';
  end if;

  insert into vacaciones_barberos (barbero_id, fecha_inicio, fecha_fin, motivo, estado)
  values (v_barbero, p_inicio, p_fin, p_motivo, 'pendiente')
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function solicitar_vacaciones(date, date, text) from public, anon;
grant execute on function solicitar_vacaciones(date, date, text) to authenticated;
