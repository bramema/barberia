/* =============================================================
   Barbería Royal — Horarios de los barberos y permisos del admin
   Ejecutar en Supabase → SQL Editor (se puede volver a ejecutar sin problema).

   Se apoya en la tabla horarios_barberos que ya existe:
     barbero_id → barberos.id (on delete cascade)
     dia_semana 0 = domingo, 1 = lunes … 6 = sábado
     hora_inicio, hora_fin, activo (false = ese día no atiende)
   No crea tablas ni modifica los horarios guardados.
   ============================================================= */

-- ¿El usuario en sesión es administrador?
create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
$$;

/* ---------- Barberos: el personal los consulta, solo el admin los modifica ---------- */
drop policy if exists "personal barberos" on barberos;
create policy "personal barberos" on barberos
  for select to authenticated using (es_personal());
drop policy if exists "admin barberos" on barberos;
create policy "admin barberos" on barberos
  for all to authenticated using (es_admin()) with check (es_admin());

/* ---------- Horarios: hoy no tienen políticas, así que nadie los puede leer desde la web ----------
   El personal los consulta; los cambios se hacen solo con guardar_horario_barbero().
*/
alter table horarios_barberos enable row level security;
drop policy if exists "personal horarios" on horarios_barberos;
create policy "personal horarios" on horarios_barberos
  for select to authenticated using (es_personal());

-- Reemplaza el horario completo de un barbero en una sola transacción.
-- p_horario: [{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"18:00","activo":true}, …]
create or replace function guardar_horario_barbero(p_barbero_id bigint, p_horario jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador puede cambiar horarios.'; end if;
  if not exists (select 1 from barberos where id = p_barbero_id) then raise exception 'El barbero no existe.'; end if;
  if jsonb_typeof(p_horario) <> 'array' or exists (
    select 1 from jsonb_array_elements(p_horario) d
    where (d ->> 'dia_semana')::int not between 1 and 6
       or (d ->> 'hora_inicio')::time < '09:00' or (d ->> 'hora_fin')::time > '19:00'
       or (d ->> 'hora_inicio')::time >= (d ->> 'hora_fin')::time
  ) then
    raise exception 'El horario no es válido (lunes a sábado, de 9:00 a 19:00).';
  end if;

  delete from horarios_barberos where barbero_id = p_barbero_id;
  insert into horarios_barberos (barbero_id, dia_semana, hora_inicio, hora_fin, activo)
  select p_barbero_id, (d ->> 'dia_semana')::smallint, (d ->> 'hora_inicio')::time, (d ->> 'hora_fin')::time,
         coalesce((d ->> 'activo')::boolean, true)
  from jsonb_array_elements(p_horario) d;
end $$;

revoke execute on function guardar_horario_barbero(bigint, jsonb) from public, anon;
grant execute on function guardar_horario_barbero(bigint, jsonb) to authenticated;

/* ---------- Lectura pública para la página de reservas ---------- */
create or replace function horarios_publicos()
returns table (barbero_id bigint, dia_semana smallint, hora_inicio time, hora_fin time)
language sql stable security definer set search_path = public as $$
  select h.barbero_id, h.dia_semana, h.hora_inicio, h.hora_fin
  from horarios_barberos h join barberos b on b.id = h.barbero_id
  where h.activo and b.activo
$$;
grant execute on function horarios_publicos() to anon, authenticated;

-- Vacaciones aprobadas vigentes: ese barbero no atiende entre fecha_inicio y fecha_fin (ambas incluidas)
create or replace function vacaciones_publicas()
returns table (barbero_id bigint, fecha_inicio date, fecha_fin date)
language sql stable security definer set search_path = public as $$
  select v.barbero_id, v.fecha_inicio, v.fecha_fin
  from vacaciones_barberos v
  where v.estado = 'aprobado' and v.fecha_fin >= current_date - 1
$$;
grant execute on function vacaciones_publicas() to anon, authenticated;

/* ---------- Una cita nueva debe caber dentro del horario de su barbero y no caer en sus vacaciones ----------
   Solo se valida al crear la cita: el admin puede reagendar libremente.
*/
create or replace function validar_horario_barbero() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'cancelada' then return new; end if;
  if not exists (
    select 1 from horarios_barberos h
    where h.barbero_id = new.barbero_id and h.activo
      and h.dia_semana = extract(dow from new.fecha)
      and h.hora_inicio <= new.hora_inicio
      and new.hora_fin <= h.hora_fin
  ) then
    raise exception 'El barbero no atiende a esa hora. Elige otra.';
  end if;
  if exists (
    select 1 from vacaciones_barberos v
    where v.barbero_id = new.barbero_id and v.estado = 'aprobado'
      and new.fecha between v.fecha_inicio and v.fecha_fin
  ) then
    raise exception 'El barbero está de vacaciones ese día. Elige otro.';
  end if;
  return new;
end $$;

drop trigger if exists citas_horario_barbero on citas;
create trigger citas_horario_barbero before insert on citas
  for each row execute function validar_horario_barbero();
