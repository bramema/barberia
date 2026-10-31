/* =============================================================
   Barbería Royal — Revisión de las cuentas de acceso de los barberos
   SOLO LECTURA: no modifica nada. Ejecutar en Supabase → SQL Editor.

   Para entrar a barbero.html un barbero necesita:
     1. Un usuario en Supabase Auth (auth.users) con correo y contraseña.
     2. Una fila en "perfiles" con el mismo id del usuario, rol = 'barbero'
        y barbero_id apuntando a su fila en "barberos".

   Las contraseñas no se pueden leer (se guardan cifradas): solo se indica
   si el usuario tiene una asignada.
   ============================================================= */

with cuentas as (
  -- Una fila por barbero, con su perfil y su usuario de Auth si existen
  select
    'barbero'::text                                  as origen,
    b.id                                             as barbero_id,
    b.nombre                                         as barbero,
    b.activo                                         as barbero_activo,
    p.id                                             as usuario_id,
    p.rol                                            as rol,
    u.email                                          as correo,
    coalesce(u.encrypted_password, '') <> ''         as tiene_contrasena,
    u.email_confirmed_at is not null                 as correo_confirmado,
    u.banned_until is not null and u.banned_until > now() as bloqueado,
    u.last_sign_in_at                                as ultimo_ingreso
  from barberos b
  left join perfiles p   on p.barbero_id = b.id
  left join auth.users u on u.id = p.id

  union all

  -- Perfiles con rol barbero que no están enlazados a ningún barbero
  select
    'perfil sin barbero', null, p.nombre, null, p.id, p.rol, u.email,
    coalesce(u.encrypted_password, '') <> '', u.email_confirmed_at is not null,
    u.banned_until is not null and u.banned_until > now(), u.last_sign_in_at
  from perfiles p
  left join auth.users u on u.id = p.id
  where p.rol = 'barbero'
    and (p.barbero_id is null or not exists (select 1 from barberos b where b.id = p.barbero_id))

  union all

  -- Usuarios de Auth sin perfil: pueden iniciar sesión pero el panel los rechaza
  select
    'usuario sin perfil', null, null, null, u.id, null, u.email,
    coalesce(u.encrypted_password, '') <> '', u.email_confirmed_at is not null,
    u.banned_until is not null and u.banned_until > now(), u.last_sign_in_at
  from auth.users u
  where not exists (select 1 from perfiles p where p.id = u.id)
)
select
  origen, barbero_id, barbero, barbero_activo, correo, rol,
  tiene_contrasena, correo_confirmado, bloqueado, ultimo_ingreso, usuario_id,
  case
    when origen = 'usuario sin perfil'  then 'Tiene cuenta en Auth pero no perfil: falta insertarlo en perfiles'
    when origen = 'perfil sin barbero'  then 'Perfil de barbero sin barbero_id válido: falta enlazarlo'
    when usuario_id is null             then 'Sin cuenta: falta crear el usuario en Auth y su perfil'
    when correo is null                 then 'El perfil apunta a un usuario que ya no existe en Auth'
    when rol <> 'barbero'               then 'El perfil tiene rol "' || rol || '", no "barbero"'
    when not tiene_contrasena           then 'Sin contraseña: enviar invitación o asignar una'
    when not correo_confirmado          then 'Correo sin confirmar: no podrá iniciar sesión'
    when bloqueado                      then 'Usuario bloqueado en Auth'
    when not barbero_activo             then 'OK, pero el barbero está inactivo'
    else 'OK: puede iniciar sesión'
  end as diagnostico
from cuentas
order by origen, barbero_id nulls last, correo;
