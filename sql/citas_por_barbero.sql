/* =============================================================
   Barbería Royal — Cada barbero solo ve y gestiona sus propias citas
   Ejecutar en Supabase → SQL Editor después de horarios_barberos.sql
   (usa es_admin()). Se puede volver a ejecutar sin problema.

   Antes: cualquier usuario del personal (admin o barbero) podía leer y
   modificar todas las citas y todos los clientes.
   Ahora:
     - admin   → acceso completo a citas y clientes.
     - barbero → solo las citas con su barbero_id y los clientes de esas citas;
                 en sus citas solo puede cambiar el estado y las observaciones.
   ============================================================= */

-- barbero_id del usuario en sesión (null si no es un barbero enlazado)
create or replace function mi_barbero_id() returns bigint
language sql stable security definer set search_path = public as $$
  select barbero_id from perfiles where id = auth.uid() and rol = 'barbero'
$$;

/* ---------- Citas ---------- */
drop policy if exists "personal citas" on citas;

drop policy if exists "admin citas" on citas;
create policy "admin citas" on citas
  for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists "barbero ve sus citas" on citas;
create policy "barbero ve sus citas" on citas
  for select to authenticated using (barbero_id = mi_barbero_id());

drop policy if exists "barbero actualiza sus citas" on citas;
create policy "barbero actualiza sus citas" on citas
  for update to authenticated
  using (barbero_id = mi_barbero_id()) with check (barbero_id = mi_barbero_id());

-- En sus citas, un barbero solo puede cambiar el estado y las observaciones
create or replace function citas_cambios_barbero() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if mi_barbero_id() is not null and (
       new.fecha       is distinct from old.fecha
    or new.hora_inicio is distinct from old.hora_inicio
    or new.hora_fin    is distinct from old.hora_fin
    or new.cliente_id  is distinct from old.cliente_id
    or new.servicio_id is distinct from old.servicio_id
    or new.barbero_id  is distinct from old.barbero_id
    or new.creado_en   is distinct from old.creado_en
  ) then
    raise exception 'Solo puedes cambiar el estado de tus citas.';
  end if;
  return new;
end $$;

drop trigger if exists citas_cambios_barbero on citas;
create trigger citas_cambios_barbero before update on citas
  for each row execute function citas_cambios_barbero();

/* ---------- Clientes ---------- */
drop policy if exists "personal clientes" on clientes;

drop policy if exists "admin clientes" on clientes;
create policy "admin clientes" on clientes
  for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists "barbero ve sus clientes" on clientes;
create policy "barbero ve sus clientes" on clientes
  for select to authenticated
  using (exists (select 1 from citas c where c.cliente_id = clientes.id and c.barbero_id = mi_barbero_id()));
