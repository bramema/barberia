/* =============================================================
   Barbería Royal — Horario de los barberos sin límite de 7:00 a 19:00
   Ejecutar en Supabase → SQL Editor DESPUÉS de varios_servicios.sql.
   Se puede volver a ejecutar sin problema. No modifica ningún dato.

   Antes la barbería atendía solo de 7:00 a 19:00: el admin no podía guardar
   horarios fuera de ese rango y los clientes no podían reservar fuera de él.
   Ahora cada barbero puede tener cualquier horario entre las 0:00 y las 24:00
   (medianoche), en tramos de 30 minutos, y las reservas siguen su horario.
   Siguen igual: lunes a sábado, citas en punto o y media.
   ============================================================= */

/* ---------- Guardar horario: cualquier hora del día ---------- */
-- p_horario: [{"dia_semana":1,"hora_inicio":"09:00","hora_fin":"24:00","activo":true}, …]
create or replace function guardar_horario_barbero(p_barbero_id bigint, p_horario jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador puede cambiar horarios.'; end if;
  if not exists (select 1 from barberos where id = p_barbero_id) then raise exception 'El barbero no existe.'; end if;
  if jsonb_typeof(p_horario) <> 'array' or exists (
    select 1 from jsonb_array_elements(p_horario) d
    where (d ->> 'dia_semana')::int not between 1 and 6
       or (d ->> 'hora_inicio')::time >= (d ->> 'hora_fin')::time
       or extract(minute from (d ->> 'hora_inicio')::time) not in (0, 30)
       or extract(minute from (d ->> 'hora_fin')::time) not in (0, 30)
  ) then
    raise exception 'El horario no es válido (lunes a sábado; la salida debe ser posterior a la entrada).';
  end if;

  delete from horarios_barberos where barbero_id = p_barbero_id;
  insert into horarios_barberos (barbero_id, dia_semana, hora_inicio, hora_fin, activo)
  select p_barbero_id, (d ->> 'dia_semana')::smallint, (d ->> 'hora_inicio')::time, (d ->> 'hora_fin')::time,
         coalesce((d ->> 'activo')::boolean, true)
  from jsonb_array_elements(p_horario) d;
end $$;

revoke execute on function guardar_horario_barbero(bigint, jsonb) from public, anon;
grant execute on function guardar_horario_barbero(bigint, jsonb) to authenticated;

/* ---------- Agendar: cualquier hora dentro del horario del barbero ---------- */
create or replace function agendar_cita(
  p_nombre text, p_email text, p_servicios bigint[], p_fecha date, p_hora time, p_barbero_id bigint
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ahora timestamp := now() at time zone 'America/Bogota';  -- fecha y hora actuales en Colombia
  v_ids bigint[];
  v_n int;
  v_total int;
  v_ini int;   -- minutos desde las 0:00
  v_fin time;
  v_cliente bigint;
  v_cita bigint;
begin
  p_nombre := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  p_email := lower(trim(coalesce(p_email, '')));

  if length(p_nombre) < 5 or length(p_nombre) > 80 or position(' ' in p_nombre) = 0 then
    raise exception 'Escribe tu nombre completo.';
  end if;
  if length(p_email) > 100 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'El correo no es válido.';
  end if;

  -- Servicios sin repetir, en el orden en que se eligieron
  v_ids := array(
    select u.id from unnest(p_servicios) with ordinality as u(id, i)
    where u.id is not null group by u.id order by min(u.i)
  );
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'Elige al menos un servicio.'; end if;
  if array_length(v_ids, 1) > 6 then raise exception 'Puedes elegir hasta 6 servicios por cita.'; end if;

  select count(*), coalesce(sum(s.duracion_minutos), 0) into v_n, v_total
  from servicios s where s.id = any(v_ids) and s.activo;
  if v_n <> array_length(v_ids, 1) then
    raise exception 'Algún servicio ya no está disponible. Recarga la página.';
  end if;

  if not exists (select 1 from barberos where id = p_barbero_id and activo) then
    raise exception 'El barbero no está disponible.';
  end if;

  if p_fecha is null or p_fecha < v_ahora::date or p_fecha > v_ahora::date + 100 then
    raise exception 'La fecha no es válida.';
  end if;
  if extract(isodow from p_fecha) = 7 then raise exception 'Los domingos no atendemos.'; end if;
  -- Cualquier hora en punto o y media; el límite real es el horario del barbero
  if p_hora is null or extract(minute from p_hora) not in (0, 30) or extract(second from p_hora) <> 0 then
    raise exception 'La hora no es válida.';
  end if;
  if p_fecha + p_hora <= v_ahora then
    raise exception 'Esa hora ya pasó. Elige otra.';
  end if;

  -- Todos los servicios seguidos deben terminar el mismo día y caber en el horario del barbero
  v_ini := (extract(epoch from p_hora) / 60)::int;
  if v_ini + v_total > 24 * 60 then
    raise exception 'Los servicios elegidos (% min) terminan después de medianoche. Elige una hora más temprana.', v_total;
  end if;
  -- time + interval da la vuelta a las 0:00: una cita que termina justo a medianoche se guarda como 24:00
  v_fin := case when v_ini + v_total = 24 * 60 then time '24:00' else p_hora + make_interval(mins => v_total) end;
  if not exists (
    select 1 from horarios_barberos h
    where h.barbero_id = p_barbero_id and h.activo
      and h.dia_semana = extract(dow from p_fecha)
      and h.hora_inicio <= p_hora and v_fin <= h.hora_fin
  ) then
    raise exception 'El barbero no atiende de % a %. Elige otra hora.', to_char(p_hora, 'HH24:MI'), to_char(v_fin, 'HH24:MI');
  end if;

  select id into v_cliente from clientes where lower(correo) = p_email limit 1;
  if v_cliente is null then
    insert into clientes (nombre, correo) values (p_nombre, p_email) returning id into v_cliente;
  end if;

  -- El trigger citas_sin_cruces impide que se cruce con otra cita del barbero
  insert into citas (fecha, hora_inicio, hora_fin, estado, servicio_id, cliente_id, barbero_id)
  values (p_fecha, p_hora, v_fin, 'pendiente', v_ids[1], v_cliente, p_barbero_id)
  returning id into v_cita;

  insert into cita_servicios (cita_id, servicio_id, orden, precio, duracion_minutos)
  select v_cita, s.id, u.i, s.precio, s.duracion_minutos
  from unnest(v_ids) with ordinality as u(id, i) join servicios s on s.id = u.id;

  return v_cita;
exception when unique_violation then
  raise exception 'El barbero ya tiene una cita en ese horario. Elige otra hora.' using errcode = '23505';
end $$;

revoke execute on function agendar_cita(text, text, bigint[], date, time, bigint) from public;
grant execute on function agendar_cita(text, text, bigint[], date, time, bigint) to anon, authenticated;
