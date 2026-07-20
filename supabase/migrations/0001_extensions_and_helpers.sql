-- Extensions
create extension if not exists pgcrypto;

-- JWT claim helpers: RLS policies read tenant/role from the JWT set by the
-- custom access token hook (0006), not from a table lookup on every check.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

-- "user_role" (not "role"): the top-level JWT "role" claim is reserved by
-- PostgREST to pick the Postgres role (anon/authenticated/service_role) for
-- the request — overwriting it with owner/manager/... breaks RLS entirely.
create or replace function public.current_role()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'user_role'
$$;

-- Platform admin claim: stubbed ahead of the Faz 4 platform_admins table so
-- RLS policies written now don't need a second migration to add admin access.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_platform_admin')::boolean, false)
$$;
