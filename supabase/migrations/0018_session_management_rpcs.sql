-- Masa taşıma yalnızca personel RPC'si (RULES #27) — müşteri arayüzünde
-- hiçbir koşulda sunulmaz. İzin bayrağı (session.move) RPC İÇİNDE ayrıca
-- doğrulanır (owner bypass + role_permissions lookup, can()'in SQL karşılığı)
-- — RULES #41 "can() katmanı atlanamaz" ilkesi, herhangi bir staff
-- tarayıcısının RPC'yi doğrudan çağırabileceği ihtimaline karşı savunma.
create or replace function public.move_table_session(
  p_table_session_id uuid, p_to_table_id uuid, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_tenant_id uuid := public.current_tenant_id();
  v_allowed boolean;
  v_from_table_id uuid;
  v_branch_id uuid;
  v_to_branch_id uuid;
  v_status text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  v_role := public.current_role();
  if v_role = 'owner' then
    v_allowed := true;
  else
    select allowed into v_allowed from public.role_permissions
    where tenant_id = v_tenant_id and role = v_role and permission_key = 'session.move';
  end if;
  if not coalesce(v_allowed, false) then
    raise exception 'PERMISSION_DENIED:session.move';
  end if;

  select table_id, branch_id, status into v_from_table_id, v_branch_id, v_status
  from public.table_sessions
  where id = p_table_session_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status <> 'active' then
    raise exception 'table session is not active';
  end if;

  select branch_id into v_to_branch_id from public.tables
  where id = p_to_table_id and tenant_id = v_tenant_id and is_active;
  if not found or v_to_branch_id <> v_branch_id then
    raise exception 'invalid destination table';
  end if;

  if exists (select 1 from public.table_sessions where table_id = p_to_table_id and status = 'active') then
    raise exception 'destination table already occupied';
  end if;

  update public.table_sessions
  set table_id = p_to_table_id, last_activity_at = now()
  where id = p_table_session_id;

  insert into public.session_events
    (tenant_id, branch_id, table_session_id, event_type, from_table_id, to_table_id, actor_profile_id, reason)
  values
    (v_tenant_id, v_branch_id, p_table_session_id, 'table_moved', v_from_table_id, p_to_table_id, auth.uid(), p_reason);
end;
$$;
revoke all on function public.move_table_session(uuid, uuid, text) from public;
grant execute on function public.move_table_session(uuid, uuid, text) to authenticated;

create or replace function public.close_table_session(p_table_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_branch_id uuid;
  v_tenant_id uuid := public.current_tenant_id();
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  -- 'payment' Faz 3'te (kasa/ödeme) aktifleşir; Faz 1'de yalnız manuel kapama var.
  if p_reason <> 'manual' then
    raise exception 'invalid close reason';
  end if;

  select status, branch_id into v_status, v_branch_id from public.table_sessions
  where id = p_table_session_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status <> 'active' then
    raise exception 'table session is not active';
  end if;

  update public.table_sessions
  set status = 'closed', closed_at = now(), close_reason = p_reason
  where id = p_table_session_id;

  insert into public.session_events (tenant_id, branch_id, table_session_id, event_type, actor_profile_id, reason)
  values (v_tenant_id, v_branch_id, p_table_session_id, 'closed', auth.uid(), p_reason);
end;
$$;
revoke all on function public.close_table_session(uuid, text) from public;
grant execute on function public.close_table_session(uuid, text) to authenticated;

-- Yalnızca pg_cron (postgres sahipliğiyle) çağırır — hiçbir role GRANT'i yok.
create or replace function public.close_stale_table_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with closed as (
    update public.table_sessions ts
    set status = 'closed', closed_at = now(), close_reason = 'timeout'
    from public.tenant_settings s
    where ts.tenant_id = s.tenant_id
      and ts.status = 'active'
      and ts.last_activity_at < now() - (s.session_timeout_minutes || ' minutes')::interval
    returning ts.id, ts.tenant_id, ts.branch_id
  )
  insert into public.session_events (tenant_id, branch_id, table_session_id, event_type, reason)
  select tenant_id, branch_id, id, 'closed', 'timeout' from closed;
end;
$$;
-- pg_cron zaten postgres (superuser) olarak çalışır, grant'a bağımlı değil;
-- service_role'e grant yalnızca test/ops'tan elle tetikleyebilmek için —
-- guest/staff (authenticated/anon) hiçbir koşulda çağıramaz.
revoke all on function public.close_stale_table_sessions() from public, authenticated, anon;
grant execute on function public.close_stale_table_sessions() to service_role;
