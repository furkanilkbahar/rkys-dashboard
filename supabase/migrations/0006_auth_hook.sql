-- Custom access token hook: bakes tenant_id/role into the JWT at token-issue
-- time so RLS policies (current_tenant_id()/current_role()) never need an
-- extra table lookup per request. Enabled via supabase/config.toml
-- [auth.hook.custom_access_token].
-- security definer: GoTrue calls this as supabase_auth_admin, which has no
-- grants on public.profiles and would otherwise hit RLS/permission errors.
-- Running as the function owner (postgres, table owner) bypasses both.
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
begin
  claims := event -> 'claims';

  select tenant_id, role into profile
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  if profile.tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(profile.tenant_id::text));
    -- "user_role", not "role": see 0001 for why the reserved claim is off-limits.
    claims := jsonb_set(claims, '{user_role}', to_jsonb(profile.role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
