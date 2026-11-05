/* =============================================================
   Barbería Royal — Varios servicios por cita
   Ejecutar en Supabase → SQL Editor después de agendar_cita_barbero.sql,
   citas_por_barbero.sql y servicios_admin.sql. Se puede volver a ejecutar sin problema.

   - Una cita puede tener varios servicios (tabla cita_servicios). Su duración es
     la suma de las duraciones: hora_fin = hora_inicio + total.
   - El barbero queda ocupado durante TODA la cita: ninguna otra cita suya puede
     cruzarse con ese rango. Antes solo se impedía repetir la misma hora de inicio,
     así que un servicio de 45 min a las 9:00 dejaba libre las 9:30.
   - citas.servicio_id se conserva (guarda el primer servicio) para no romper
     nada que todavía lo use.
   ============================================================= */

/* ---------- Servicios de cada cita ----------
   precio y duracion_minutos se copian al reservar: si después se edita el servicio,
   la cita conserva lo que se cobró y lo que duró. */
create table if not exists cita_servicios (
  cita_id          bigint   not null references citas(id) on delete cascade,
  servicio_id      bigint   not null references servicios(id),
  orden            smallint not null default 1,
  precio           numeric  not null default 0,
  duracion_minutos integer  not null,
  primary key (cita_id, servicio_id)
);
create index if not exists cita_servicios_servicio on cita_servicios (servicio_id);

-- Las citas que ya existían pasan a tener su único servicio en la tabla nueva
insert into cita_servicios (cita_id, servicio_id, orden, precio, duracion_minutos)
select c.id, c.servicio_id, 1, s.precio, s.duracion_minutos
from citas c join servicios s on s.id = c.servicio_id
on conflict do nothing;

/* ---------- Permisos (igual que en citas) ---------- */
alter table cita_servicios enable row level security;

drop policy if exists "admin cita_servicios" on cita_servicios;
create policy "admin cita_servicios" on cita_servicios
  for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists "barbero ve servicios de sus citas" on cita_servicios;
create policy "barbero ve servicios de sus citas" on cita_servicios
  for select to authenticated
  using (exists (select 1 from citas c where c.id = cita_servicios.cita_id and c.barbero_id = mi_barbero_id()));

/* ---------- Un barbero no puede tener dos citas que se crucen ----------
   Se revisa al crear una cita y al cambiarle fecha, hora o barbero (p. ej. al reagendar).
   Cambiar solo el estado no se revisa, así las citas antiguas que ya se cruzaban
   se pueden seguir completando o cancelando.
   Las citas antiguas sin barbero ocupan esa hora para todos (igual que en la página). */
create or replace function validar_cruce_citas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'cancelada' then return new; end if;
  if tg_op = 'UPDATE' and old.estado <> 'cancelada'
     and new.fecha = old.fecha and new.hora_inicio = old.hora_inicio and new.hora_fin = old.hora_fin
     and new.barbero_id is not distinct from old.barbero_id then
    return new;
  end if;
  if new.hora_fin is null or new.hora_fin <= new.hora_inicio then
    raise exception 'La cita debe terminar después de la hora de inicio.';
  end if;

  -- Candado por barbero: dos reservas simultáneas se revisan una después de la otra
  perform pg_advisory_xact_lock(7301, coalesce(new.barbero_id, 0)::int);

  if exists (
    select 1 from citas c
    where c.id is distinct from new.id
      and c.estado <> 'cancelada'
      and c.fecha = new.fecha
      and (c.barbero_id = new.barbero_id or c.barbero_id is null or new.barbero_id is null)
      and c.hora_inicio < new.hora_fin
      and new.hora_inicio < coalesce(c.hora_fin, c.hora_inicio + interval '30 minutes')
  ) then
    raise exception 'El barbero ya tiene una cita en ese horario. Elige otra hora.'
      using errcode = 'unique_violation';
  end if;
  return new;
end $$;

drop trigger if exists citas_sin_cruces on citas;
create trigger citas_sin_cruces before insert or update on citas
  for each row execute function validar_cruce_citas();

/* ---------- Horas ocupadas: ahora con la hora de fin ----------
   La página de reservas necesita saber hasta qué hora está ocupado cada barbero. */
drop function if exists horas_ocupadas();
create function horas_ocupadas()
returns table (fecha date, hora_inicio time, hora_fin time, barbero_id bigint)
language sql stable security definer set search_path = public as $$
  select c.fecha, c.hora_inicio::time,
         coalesce(c.hora_fin, c.hora_inicio + interval '30 minutes')::time,
         c.barbero_id::bigint
  from citas c
  where c.estado <> 'cancelada'
    and c.fecha >= (now() at time zone 'America/Bogota')::date - 1
$$;
revoke execute on function horas_ocupadas() from public;
grant execute on function horas_ocupadas() to anon, authenticated;

/* ---------- Agendar con uno o varios servicios ---------- */
drop function if exists agendar_cita(text, text, bigint, date, time);
drop function if exists agendar_cita(text, text, bigint, date, time, bigint);
drop function if exists agendar_cita(text, text, bigint[], date, time, bigint);

create function agendar_cita(
  p_nombre text, p_email text, p_servicios bigint[], p_fecha date, p_hora time, p_barbero_id bigint
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ahora timestamp := now() at time zone 'America/Bogota';  -- fecha y hora actuales en Colombia
  v_ids bigint[];
  v_n int;
  v_total int;
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
  -- Horario de atención: de 7:00 a 19:00
  if p_hora is null or p_hora < '07:00' or p_hora > '18:30'
     or extract(minute from p_hora) not in (0, 30) or extract(second from p_hora) <> 0 then
    raise exception 'La hora no es válida.';
  end if;
  if p_fecha + p_hora <= v_ahora then
    raise exception 'Esa hora ya pasó. Elige otra.';
  end if;

  -- Todos los servicios seguidos deben caber antes del cierre y dentro del horario del barbero
  if extract(epoch from p_hora) / 60 + v_total > 19 * 60 then
    raise exception 'Los servicios elegidos (% min) terminan después de las 19:00. Elige una hora más temprana.', v_total;
  end if;
  v_fin := p_hora + make_interval(mins => v_total);
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
