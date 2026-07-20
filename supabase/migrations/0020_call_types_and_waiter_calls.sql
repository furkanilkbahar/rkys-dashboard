-- D35: standart set + tenant-özel çağrı tipleri + tipsiz tek dokunuş
-- (call_type_id null). İsimler content_translations'tan (entity_type='call_type').
create table public.call_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  is_system boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);
create index idx_call_types_tenant_id on public.call_types(tenant_id);
alter table public.call_types enable row level security;
create policy "call_types_select" on public.call_types for select
  using (tenant_id = public.current_tenant_id());
create policy "call_types_staff_write" on public.call_types for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.call_types to authenticated, service_role;

-- Mutasyon yine RPC-only (RULES #5): authenticated'a insert/update/delete
-- grant'i yok, yalnız SELECT.
create table public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  call_type_id uuid references public.call_types(id),
  note text,
  status text not null default 'open' check (status in ('open', 'acknowledged')),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_waiter_calls_tenant_id on public.waiter_calls(tenant_id);
create index idx_waiter_calls_table_session_id on public.waiter_calls(table_session_id);
create index idx_waiter_calls_tenant_branch_status on public.waiter_calls(tenant_id, branch_id, status);
alter table public.waiter_calls enable row level security;
create policy "waiter_calls_select" on public.waiter_calls for select
  using (
    (tenant_id = public.current_tenant_id() and public.is_staff())
    or table_session_id = public.current_table_session_id()
  );
grant select on public.waiter_calls to authenticated;
grant select, insert, update, delete on public.waiter_calls to service_role;

-- call_waiter: RULES #8 basit rate limit (aynı oturumdan 15sn'de 1 çağrı).
create or replace function public.call_waiter(p_call_type_key text default null, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_session_id uuid := public.current_table_session_id();
  v_branch_id uuid;
  v_call_type_id uuid;
  v_recent_count integer;
  v_call_id uuid;
begin
  if public.current_role() <> 'guest' or v_session_id is null then
    raise exception 'guest table session required';
  end if;

  select branch_id into v_branch_id from public.table_sessions
  where id = v_session_id and status = 'active';
  if not found then
    raise exception 'table session is not active';
  end if;

  if p_call_type_key is not null then
    select id into v_call_type_id from public.call_types
    where tenant_id = v_tenant_id and key = p_call_type_key and is_active;
    if not found then
      raise exception 'invalid call type';
    end if;
  end if;

  select count(*) into v_recent_count
  from public.waiter_calls
  where table_session_id = v_session_id and created_at > now() - interval '15 seconds';
  if v_recent_count > 0 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.waiter_calls (tenant_id, branch_id, table_session_id, call_type_id, note)
  values (v_tenant_id, v_branch_id, v_session_id, v_call_type_id, p_note)
  returning id into v_call_id;

  update public.table_sessions set last_activity_at = now() where id = v_session_id;

  return v_call_id;
end;
$$;
revoke all on function public.call_waiter(text, text) from public;
grant execute on function public.call_waiter(text, text) to authenticated;

create or replace function public.acknowledge_waiter_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select status into v_status from public.waiter_calls
  where id = p_call_id and tenant_id = public.current_tenant_id()
  for update;
  if not found or v_status <> 'open' then
    raise exception 'call is not open';
  end if;

  update public.waiter_calls
  set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now()
  where id = p_call_id;
end;
$$;
revoke all on function public.acknowledge_waiter_call(uuid) from public;
grant execute on function public.acknowledge_waiter_call(uuid) to authenticated;
