-- Faz 2 Adım 5: personel yönetimi. Rol/PIN/cihaz mutasyonu doğrudan RLS
-- yerine SECURITY DEFINER RPC'ler üzerinden — "son owner düşürülemez",
-- "yalnız owner owner atayabilir" gibi invariant'lar düz RLS politikasıyla
-- ifade edilemez (move_table_session'daki defense-in-depth deseniyle aynı).

-- Güvenlik açığı düzeltmesi: profiles_self_update (0003) herhangi bir
-- kolonu self-update'e izin veriyordu — bir personel kendi role/is_active/
-- tenant_id'sini REST üzerinden değiştirebilirdi (self-promotion riski).
-- Bu trigger, yalnızca aşağıdaki RPC'lerin bilerek açtığı bir session
-- flag'i varken bu üç kolonun değişmesine izin verir.
create or replace function public.prevent_unauthorized_profile_escalation()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.tenant_id is distinct from old.tenant_id)
     and coalesce(current_setting('rkys.allow_profile_escalation', true), '') <> 'true' then
    raise exception 'role/is_active/tenant_id yalnızca personel yönetimi fonksiyonları üzerinden değiştirilebilir';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_escalation
before update on public.profiles
for each row execute function public.prevent_unauthorized_profile_escalation();

-- can()'in (src/lib/auth/can.ts) SQL karşılığı — owner bypass +
-- role_permissions lookup, session.move (0018) ile aynı desen.
create or replace function public.current_can(p_permission_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  if public.current_role() = 'owner' then
    return true;
  end if;

  select allowed into v_allowed from public.role_permissions
  where tenant_id = public.current_tenant_id()
    and role = public.current_role()
    and permission_key = p_permission_key;

  return coalesce(v_allowed, false);
end;
$$;
revoke all on function public.current_can(text) from public;
grant execute on function public.current_can(text) to authenticated;

create or replace function public.update_staff_member(
  p_profile_id uuid,
  p_role text,
  p_badge_no text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_role text;
  v_actor_role text := public.current_role();
  v_owner_count integer;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;

  select role into v_current_role from public.profiles
  where id = p_profile_id and tenant_id = public.current_tenant_id()
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  if p_role = 'owner' and v_current_role <> 'owner' and v_actor_role <> 'owner' then
    raise exception 'only an owner can grant the owner role';
  end if;

  if v_current_role = 'owner' and (p_role <> 'owner' or not p_is_active) then
    select count(*) into v_owner_count from public.profiles
    where tenant_id = public.current_tenant_id() and role = 'owner' and is_active;

    if v_owner_count <= 1 then
      raise exception 'cannot demote or deactivate the last owner';
    end if;
  end if;

  perform set_config('rkys.allow_profile_escalation', 'true', true);
  update public.profiles
  set role = p_role, badge_no = p_badge_no, is_active = p_is_active
  where id = p_profile_id and tenant_id = public.current_tenant_id();
end;
$$;
revoke all on function public.update_staff_member(uuid, text, text, boolean) from public;
grant execute on function public.update_staff_member(uuid, text, text, boolean) to authenticated;

create or replace function public.reset_staff_pin(p_profile_id uuid, p_new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;
  if p_new_pin !~ '^[0-9]{4,8}$' then
    raise exception 'pin must be 4-8 digits';
  end if;

  update public.profiles
  set pin_hash = crypt(p_new_pin, gen_salt('bf'))
  where id = p_profile_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'profile not found';
  end if;
end;
$$;
revoke all on function public.reset_staff_pin(uuid, text) from public;
grant execute on function public.reset_staff_pin(uuid, text) to authenticated;

create or replace function public.create_staff_device(p_branch_id uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;

  v_secret := encode(gen_random_bytes(24), 'base64');

  insert into public.staff_devices (tenant_id, branch_id, device_label, device_secret_hash)
  values (public.current_tenant_id(), p_branch_id, p_label, crypt(v_secret, gen_salt('bf')));

  return v_secret;
end;
$$;
revoke all on function public.create_staff_device(uuid, text) from public;
grant execute on function public.create_staff_device(uuid, text) to authenticated;

create or replace function public.revoke_staff_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;

  update public.staff_devices
  set is_active = false
  where id = p_device_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'device not found';
  end if;
end;
$$;
revoke all on function public.revoke_staff_device(uuid) from public;
grant execute on function public.revoke_staff_device(uuid) to authenticated;
