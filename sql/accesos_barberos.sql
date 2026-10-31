/* =============================================================
   Barbería Royal — Cuentas de acceso de los barberos
   Ejecutar en Supabase → SQL Editor (se puede volver a ejecutar sin problema).

   Sin backend: el modal de barberos crea la cuenta con signUp (supabase-js)
   y luego llama a estas funciones, que solo puede usar el admin:
     - accesos_barberos()            correo y último ingreso de cada barbero
     - enlazar_acceso_barbero()      crea el perfil, confirma el correo y fija la contraseña
     - cambiar_contrasena_barbero()  asigna una contraseña nueva
   ============================================================= */

-- crypt() y gen_salt() para guardar contraseñas con el mismo cifrado (bcrypt) que usa Supabase Auth
create extension if not exists pgcrypto with schema extensions;

-- 1. Correo y último ingreso de cada barbero con cuenta
create or replace function accesos_barberos()
returns table (barbero_id bigint, correo text, ultimo_ingreso timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador puede ver los accesos.'; end if;
  return query
    select p.barbero_id, u.email::text, u.last_sign_in_at
    from perfiles p join auth.users u on u.id = p.id
    where p.barbero_id is not null;
end $$;

-- 2. Enlaza una cuenta de Auth (buscada por correo) con un barbero
create or replace function enlazar_acceso_barbero(p_correo text, p_barbero_id bigint, p_contrasena text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid;
  v_nombre text;
begin
  if not es_admin() then raise exception 'Solo el administrador puede gestionar accesos.'; end if;
  if length(coalesce(p_contrasena, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres.'; end if;

  select nombre into v_nombre from barberos where id = p_barbero_id;
  if not found then raise exception 'El barbero no existe.'; end if;
  if exists (select 1 from perfiles where barbero_id = p_barbero_id) then
    raise exception 'Este barbero ya tiene acceso. Usa "Actualizar acceso" para cambiar la contraseña.';
  end if;

  select id into v_usuario from auth.users where lower(email) = lower(trim(p_correo));
  if v_usuario is null then raise exception 'No existe ninguna cuenta con ese correo.'; end if;
  if exists (select 1 from perfiles where id = v_usuario) then
    raise exception 'Ese correo ya pertenece a otro usuario del personal.';
  end if;

  insert into perfiles (id, nombre, rol, barbero_id) values (v_usuario, v_nombre, 'barbero', p_barbero_id);
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         encrypted_password = extensions.crypt(p_contrasena, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_usuario;
end $$;

-- 3. Contraseña nueva para un barbero que ya tiene acceso
create or replace function cambiar_contrasena_barbero(p_barbero_id bigint, p_contrasena text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid;
begin
  if not es_admin() then raise exception 'Solo el administrador puede gestionar accesos.'; end if;
  if length(coalesce(p_contrasena, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres.'; end if;

  select id into v_usuario from perfiles where barbero_id = p_barbero_id and rol = 'barbero';
  if v_usuario is null then raise exception 'Este barbero aún no tiene acceso.'; end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_contrasena, extensions.gen_salt('bf')), updated_at = now()
   where id = v_usuario;
end $$;

revoke execute on function accesos_barberos() from public, anon;
revoke execute on function enlazar_acceso_barbero(text, bigint, text) from public, anon;
revoke execute on function cambiar_contrasena_barbero(bigint, text) from public, anon;
grant execute on function accesos_barberos() to authenticated;
grant execute on function enlazar_acceso_barbero(text, bigint, text) to authenticated;
grant execute on function cambiar_contrasena_barbero(bigint, text) to authenticated;

-- 4. barbero1@gmail.com ya existe en Auth pero sin perfil: queda como cuenta de Santiago López (id 1)
insert into perfiles (id, nombre, rol, barbero_id)
select u.id, b.nombre, 'barbero', b.id
from auth.users u join barberos b on b.id = 1
where lower(u.email) = 'barbero1@gmail.com'
on conflict (id) do update
  set nombre = excluded.nombre, rol = excluded.rol, barbero_id = excluded.barbero_id;
