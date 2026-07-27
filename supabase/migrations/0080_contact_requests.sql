-- Faz 13 Adım 2 (S58): pazarlama sitesi iletişim/demo talep formu.
-- RULES #5: anon'dan doğrudan tabloya insert yasak — misafir masa siparişi
-- akışındaki gerekçeyle aynı, kök domaindeki bu form da bir SECURITY
-- DEFINER RPC üzerinden yazar, anon'a doğrudan INSERT grant edilmez.

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

create policy "contact_requests_platform_admin_all"
  on public.contact_requests for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, update, delete on public.contact_requests to authenticated, service_role;
grant insert on public.contact_requests to service_role;

create or replace function public.submit_contact_request(
  p_name text,
  p_business_name text,
  p_email text,
  p_phone text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.contact_requests (name, business_name, email, phone, message)
  values (p_name, p_business_name, p_email, p_phone, p_message);
end;
$$;
revoke all on function public.submit_contact_request(text, text, text, text, text) from public;
grant execute on function public.submit_contact_request(text, text, text, text, text) to anon, authenticated;

-- resolve_contact_request: platform admin talebi 'contacted'/'closed' olarak
-- işaretler — suspend_tenant (0037) deseninin klonu.
create or replace function public.resolve_contact_request(p_request_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  if p_status not in ('contacted', 'closed') then
    raise exception 'invalid status';
  end if;

  update public.contact_requests set status = p_status where id = p_request_id;
  if not found then
    raise exception 'contact request not found';
  end if;
end;
$$;
revoke all on function public.resolve_contact_request(uuid, text) from public;
grant execute on function public.resolve_contact_request(uuid, text) to authenticated;
