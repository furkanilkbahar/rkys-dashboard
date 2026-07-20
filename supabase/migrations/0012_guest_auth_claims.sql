-- custom_access_token_hook (0006) genişletilir: profiles'ta kayıt yoksa
-- (misafir kullanıcı — Supabase Anonymous Auth, bkz. 0013) kullanıcı
-- table_session_devices'a bağlıysa JWT'ye user_role='guest' + tenant_id +
-- branch_id + table_session_id claim'leri basılır. security definer
-- (postgres sahipliği) sayesinde table_session_devices RLS'ini bypass eder,
-- tıpkı profiles için olduğu gibi.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  profile record;
  guest record;
begin
  claims := event -> 'claims';

  select tenant_id, role into profile
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  if profile.tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(profile.tenant_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(profile.role));
  else
    select tenant_id, branch_id, table_session_id into guest
    from public.table_session_devices
    where guest_user_id = (event ->> 'user_id')::uuid;

    if guest.tenant_id is not null then
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(guest.tenant_id::text));
      claims := jsonb_set(claims, '{user_role}', to_jsonb('guest'::text));
      claims := jsonb_set(claims, '{branch_id}', to_jsonb(guest.branch_id::text));
      claims := jsonb_set(claims, '{table_session_id}', to_jsonb(guest.table_session_id::text));
    end if;
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;
