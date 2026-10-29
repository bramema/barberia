/* =============================================================
   Barbería Royal — Configuración de Supabase
   Ejecutar una sola vez en Supabase → SQL Editor.
   ============================================================= */

-- El formulario de reserva pide correo
alter table clientes add column if not exists correo text;

-- Servicios iniciales (solo si la tabla está vacía)
insert into servicios (nombre, precio, duracion_minutos, descripcion, activo)
select v.nombre, v.precio, v.duracion_minutos, v.descripcion, true
from (values
  ('Corte clásico',     20, 45, 'Corte a tijera y máquina con acabado clásico.'),
  ('Afeitado a navaja', 15, 30, 'Afeitado con toalla caliente y bálsamo.'),
  ('Barba y perfilado', 18, 30, 'Recorte, perfilado y cuidado de barba.'),
  ('Corte + Barba',     32, 75, 'Corte clásico más barba y perfilado.'),
  ('Limpieza facial',   25, 40, 'Limpieza profunda y mascarilla.'),
  ('Experiencia Royal', 45, 90, 'Corte, barba, facial y bebida de cortesía.')
) as v(nombre, precio, duracion_minutos, descripcion)
where not exists (select 1 from servicios);

-- Dos citas no pueden ocupar la misma hora (las canceladas no cuentan)
create unique index if not exists citas_horario_unico
  on citas (fecha, hora_inicio) where estado <> 'cancelada';

/* ---------- Roles del personal ----------
   Los usuarios se crean en Authentication → Users y su rol se guarda en "perfiles",
   con el mismo id (uuid) del usuario:
     insert into perfiles (id, nombre, rol)
       select id, 'Administrador', 'admin' from auth.users where email = 'admin@ejemplo.com';
     insert into perfiles (id, nombre, rol, barbero_id)
       select id, 'Carlos', 'barbero', 1 from auth.users where email = 'barbero@ejemplo.com';
*/
-- security definer: consulta "perfiles" sin depender de sus políticas RLS
create or replace function es_personal() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol in ('admin', 'barbero'))
$$;

-- Cada usuario puede leer su propio perfil (el login lo usa para saber su rol)
alter table perfiles enable row level security;
drop policy if exists "perfil propio" on perfiles;
create policy "perfil propio" on perfiles
  for select to authenticated using (id = auth.uid());

/* ---------- Seguridad (RLS) ---------- */
alter table servicios enable row level security;
alter table citas     enable row level security;
alter table clientes  enable row level security;
alter table barberos  enable row level security;

-- Cualquiera puede ver los servicios activos
drop policy if exists "servicios activos visibles" on servicios;
create policy "servicios activos visibles" on servicios
  for select to anon, authenticated using (activo);

-- El personal (admin y barbero) tiene acceso completo
drop policy if exists "personal servicios" on servicios;
create policy "personal servicios" on servicios
  for all to authenticated using (es_personal()) with check (es_personal());
drop policy if exists "personal citas" on citas;
create policy "personal citas" on citas
  for all to authenticated using (es_personal()) with check (es_personal());
drop policy if exists "personal clientes" on clientes;
create policy "personal clientes" on clientes
  for all to authenticated using (es_personal()) with check (es_personal());
drop policy if exists "personal barberos" on barberos;
create policy "personal barberos" on barberos
  for all to authenticated using (es_personal()) with check (es_personal());

/* ---------- Funciones públicas para la página de reservas ----------
   Los visitantes no leen las tablas directamente: solo ven qué horas
   están ocupadas y agendan a través de agendar_cita().
*/
create or replace function horas_ocupadas()
returns table (fecha date, hora_inicio time)
language sql stable security definer set search_path = public as $$
  select c.fecha, c.hora_inicio from citas c
  where c.estado <> 'cancelada' and c.fecha >= current_date - 1
$$;

create or replace function agendar_cita(
  p_nombre text, p_email text, p_servicio_id bigint, p_fecha date, p_hora time
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_servicio servicios%rowtype;
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

  -- current_date está en UTC: se acepta un día de margen por la zona horaria
  if p_fecha is null or p_fecha < current_date - 1 or p_fecha > current_date + 100 then
    raise exception 'La fecha no es válida.';
  end if;
  if extract(isodow from p_fecha) = 7 then raise exception 'Los domingos no atendemos.'; end if;
  if p_hora is null or p_hora < '09:00' or p_hora > '18:30'
     or extract(minute from p_hora) not in (0, 30) or extract(second from p_hora) <> 0 then
    raise exception 'La hora no es válida.';
  end if;

  select id into v_cliente from clientes where lower(correo) = p_email limit 1;
  if v_cliente is null then
    insert into clientes (nombre, correo) values (p_nombre, p_email) returning id into v_cliente;
  end if;

  insert into citas (fecha, hora_inicio, hora_fin, estado, servicio_id, cliente_id)
  values (p_fecha, p_hora, p_hora + make_interval(mins => v_servicio.duracion_minutos::int),
          'pendiente', v_servicio.id, v_cliente)
  returning id into v_cita;
  return v_cita;
exception when unique_violation then
  raise exception 'Esa hora acaba de ser reservada. Elige otra.' using errcode = '23505';
end $$;

grant execute on function horas_ocupadas() to anon, authenticated;
grant execute on function agendar_cita(text, text, bigint, date, time) to anon, authenticated;
