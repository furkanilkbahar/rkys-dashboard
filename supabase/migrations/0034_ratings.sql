-- Faz 3 Adım 5: değerlendirme sistemi. rating_settings (0027) şu ana kadar
-- yalnızca personele açıktı — misafirin is_enabled/google_review_url'i
-- okuyabilmesi için branches_guest_select (0014) ile aynı desende dar
-- kapsamlı bir SELECT politikası eklenir.
create policy "rating_settings_guest_select" on public.rating_settings for select
  using (public.current_role() = 'guest' and tenant_id = public.current_tenant_id());

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null unique references public.table_sessions(id) on delete restrict,
  stars integer not null check (stars between 1 and 5),
  comment text,
  rated_staff_id uuid references public.profiles(id),
  staff_stars integer check (staff_stars between 1 and 5),
  created_at timestamptz not null default now()
);
create index idx_ratings_tenant_id on public.ratings(tenant_id);
alter table public.ratings enable row level security;
create policy "ratings_staff_select" on public.ratings for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "ratings_guest_select_own" on public.ratings for select
  using (public.current_role() = 'guest' and table_session_id = public.current_table_session_id());
grant select on public.ratings to authenticated;
grant select, insert, update, delete on public.ratings to service_role;

-- submit_rating: misafir yalnızca KENDİ (kapanmış) oturumu için, yalnızca
-- rating_settings.is_enabled açıkken değerlendirme bırakabilir — bir oturum
-- için en fazla bir kayıt (unique table_session_id). Google köprüsü eşiği
-- (>3★) burada değil, çağıran istemci tarafında uygulanır (yönlendirme URL'i
-- zaten rating_settings'ten dönüyor, RPC yalnızca kaydı oluşturur).
create or replace function public.submit_rating(
  p_stars integer,
  p_comment text default null,
  p_rated_staff_id uuid default null,
  p_staff_stars integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_table_session_id uuid := public.current_table_session_id();
  v_branch_id uuid;
  v_session_status text;
  v_enabled boolean;
  v_rating_id uuid;
begin
  if public.current_role() <> 'guest' or v_table_session_id is null then
    raise exception 'guest only';
  end if;
  if p_stars < 1 or p_stars > 5 then
    raise exception 'invalid stars';
  end if;
  if p_staff_stars is not null and (p_staff_stars < 1 or p_staff_stars > 5) then
    raise exception 'invalid staff stars';
  end if;

  select is_enabled into v_enabled from public.rating_settings where tenant_id = v_tenant_id;
  if not coalesce(v_enabled, false) then
    raise exception 'ratings disabled';
  end if;

  select branch_id, status into v_branch_id, v_session_status
  from public.table_sessions
  where id = v_table_session_id and tenant_id = v_tenant_id;
  if not found or v_session_status <> 'closed' then
    raise exception 'session not closed';
  end if;

  if p_rated_staff_id is not null and not exists (
    select 1 from public.profiles where id = p_rated_staff_id and tenant_id = v_tenant_id and role = 'waiter'
  ) then
    raise exception 'invalid staff';
  end if;

  insert into public.ratings (tenant_id, branch_id, table_session_id, stars, comment, rated_staff_id, staff_stars)
  values (v_tenant_id, v_branch_id, v_table_session_id, p_stars, p_comment, p_rated_staff_id, p_staff_stars)
  returning id into v_rating_id;

  return v_rating_id;
end;
$$;
revoke all on function public.submit_rating(integer, text, uuid, integer) from public;
grant execute on function public.submit_rating(integer, text, uuid, integer) to authenticated;
