/* =============================================================
   Barbería Royal — Agendar cita con barbero (hora de Colombia)
   Ejecutar en Supabase → SQL Editor después de horarios_barberos.sql
   y vacaciones_barberos.sql. Se puede volver a ejecutar sin problema.

   Arregla que no se pudieran apartar citas entre las 9:00 y las 17:00:
   la base de datos trabaja en UTC (5 horas más que Colombia), así que
   comparar la cita con now()/current_date marcaba como "pasadas" horas
   que todavía no habían llegado. Ahora todo se compara con la hora local.
   ============================================================= */

-- Una misma hora puede estar ocupada por varios barberos, pero no dos veces por el mismo
drop index if exists citas_horario_unico;
create unique index if not exists citas_barbero_horario_unico
  on citas (barbero_id, fecha, hora_inicio) where estado <> 'cancelada';

drop function if exists agendar_cita(text, text, bigint, date, time);
drop function if exists agendar_cita(text, text, bigint, date, time, bigint);

create function agendar_cita(
  p_nombre text, p_email text, p_servicio_id bigint, p_fecha date, p_hora time, p_barbero_id bigint
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ahora timestamp := now() at time zone 'America/Bogota';  -- fecha y hora actuales en Colombia
  v_servicio servicios%rowtype;
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

  select * into v_servicio from servicios where id = p_servicio_id and activo;
  if not found then raise exception 'El servicio no es válido.'; end if;

  if not exists (select 1 from barberos where id = p_barbero_id and activo) then
    raise exception 'El barbero no está disponible.';
  end if;

  if p_fecha is null or p_fecha < v_ahora::date or p_fecha > v_ahora::date + 100 then
    raise exception 'La fecha no es válida.';
  end if;
  if extract(isodow from p_fecha) = 7 then raise exception 'Los domingos no atendemos.'; end if;
  -- Horario de atención: de 7:00 a 19:00
  if p_hora is null or p_hora < '07:00' or p_hora > '18:30'
     or extract(minute from p_hora) not in (0, 30) or extract(second from p_hora) <> 0 then
    raise exception 'La hora no es válida.';
  end if;
  if p_fecha + p_hora <= v_ahora then
    raise exception 'Esa hora ya pasó. Elige otra.';
  end if;

  -- El servicio completo debe caber en el horario del barbero ese día
  v_fin := p_hora + make_interval(mins => v_servicio.duracion_minutos::int);
  if v_fin < p_hora or v_fin > '19:00' or not exists (
    select 1 from horarios_barberos h
    where h.barbero_id = p_barbero_id and h.activo
      and h.dia_semana = extract(dow from p_fecha)
      and h.hora_inicio <= p_hora and v_fin <= h.hora_fin
  ) then
    raise exception 'El barbero no atiende a esa hora. Elige otra.';
  end if;

  select id into v_cliente from clientes where lower(correo) = p_email limit 1;
  if v_cliente is null then
    insert into clientes (nombre, correo) values (p_nombre, p_email) returning id into v_cliente;
  end if;

  insert into citas (fecha, hora_inicio, hora_fin, estado, servicio_id, cliente_id, barbero_id)
  values (p_fecha, p_hora, v_fin, 'pendiente', v_servicio.id, v_cliente, p_barbero_id)
  returning id into v_cita;
  return v_cita;
exception when unique_violation then
  raise exception 'Esa hora acaba de ser reservada. Elige otra.' using errcode = '23505';
end $$;

revoke execute on function agendar_cita(text, text, bigint, date, time, bigint) from public;
grant execute on function agendar_cita(text, text, bigint, date, time, bigint) to anon, authenticated;
