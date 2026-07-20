-- Bootstrap RPC'leri yalnızca Route Handler'ın service_role istemcisinden
-- çağrılır (misafirin henüz JWT'si/oturumu yokken QR token'ını doğrulayan
-- tek nokta). service_role zaten bu tablolarda gerekli GRANT'lere ve
-- bypassrls=true'ya sahip olduğu için SECURITY DEFINER'a ihtiyaç yok —
-- yalnızca iş mantığını (tekil aktif oturum kuralı, audit trail) tek yerde
-- toplar.

create or replace function public.open_or_get_active_table_session(p_table_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_tenant uuid;
  v_branch uuid;
begin
  select tenant_id, branch_id into v_tenant, v_branch
  from public.tables
  where id = p_table_id and is_active;

  if v_tenant is null then
    raise exception 'invalid or inactive table';
  end if;

  select id into v_id
  from public.table_sessions
  where table_id = p_table_id and status = 'active';

  if v_id is null then
    insert into public.table_sessions (tenant_id, branch_id, table_id)
    values (v_tenant, v_branch, p_table_id)
    returning id into v_id;

    insert into public.session_events (tenant_id, branch_id, table_session_id, event_type)
    values (v_tenant, v_branch, v_id, 'opened');
  else
    update public.table_sessions set last_activity_at = now() where id = v_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.open_or_get_active_table_session(uuid) from public;
grant execute on function public.open_or_get_active_table_session(uuid) to service_role;

create or replace function public.link_guest_device(
  p_guest_user_id uuid,
  p_table_session_id uuid,
  p_tenant_id uuid,
  p_branch_id uuid
)
returns text
language plpgsql
as $$
declare
  v_label text;
begin
  perform 1 from public.table_sessions where id = p_table_session_id for update;

  select 'Cihaz ' || (count(*) + 1) into v_label
  from public.table_session_devices
  where table_session_id = p_table_session_id;

  insert into public.table_session_devices
    (tenant_id, branch_id, table_session_id, guest_user_id, device_label)
  values (p_tenant_id, p_branch_id, p_table_session_id, p_guest_user_id, v_label);

  return v_label;
end;
$$;
revoke all on function public.link_guest_device(uuid, uuid, uuid, uuid) from public;
grant execute on function public.link_guest_device(uuid, uuid, uuid, uuid) to service_role;

create or replace function public.list_branch_tables_for_generic_qr(p_token_hash text)
returns table(table_id uuid, label text)
language sql
stable
as $$
  select t.id, t.label
  from public.tables t
  join public.generic_qr_codes g
    on g.branch_id = t.branch_id and g.qr_token_hash = p_token_hash and g.is_active
  where t.is_active
  order by t.label
$$;
revoke all on function public.list_branch_tables_for_generic_qr(text) from public;
grant execute on function public.list_branch_tables_for_generic_qr(text) to service_role;
