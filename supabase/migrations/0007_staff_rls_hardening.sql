-- Faz 1 ön koşulu: misafir (guest) rolü de Postgres "authenticated" rolünü
-- paylaşacağı için (bkz. 0012_guest_auth_claims.sql) Faz 0'ın personel-only
-- tablolarındaki "tenant_id = current_tenant_id()" politikaları artık
-- yetersiz — bir misafir de aynı koşulu sağlar. is_staff() eklenip ilgili
-- politikalar sıkılaştırılır. Bu migration anonymous sign-in açılmadan önce
-- uygulanmalıdır.
create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_role() is not null and public.current_role() <> 'guest'
$$;

-- tenants: kendi-tenant'ını-gören politika personel-only olur; platform
-- admin politikası ayrı bir claim'e (is_platform_admin) dayandığı için
-- dokunulmaz.
drop policy "tenants_select_own" on public.tenants;
create policy "tenants_select_own"
  on public.tenants for select
  using (id = public.current_tenant_id() and public.is_staff());

drop policy "tenant_domains_tenant_isolation" on public.tenant_domains;
create policy "tenant_domains_tenant_isolation"
  on public.tenant_domains for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy "branches_tenant_isolation" on public.branches;
create policy "branches_tenant_isolation"
  on public.branches for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

-- profiles_self_update kasıtlı olarak dokunulmaz: id = auth.uid() zaten
-- yalnızca kullanıcının kendi satırıyla sınırlı, misafirin hiç profile
-- satırı olmadığı için bu politikayla zaten hiçbir satıra erişemez.
drop policy "profiles_tenant_select" on public.profiles;
create policy "profiles_tenant_select"
  on public.profiles for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy "staff_branch_assignments_tenant_isolation" on public.staff_branch_assignments;
create policy "staff_branch_assignments_tenant_isolation"
  on public.staff_branch_assignments for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy "role_permissions_tenant_isolation" on public.role_permissions;
create policy "role_permissions_tenant_isolation"
  on public.role_permissions for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy "staff_devices_tenant_isolation" on public.staff_devices;
create policy "staff_devices_tenant_isolation"
  on public.staff_devices for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy "tenant_modules_tenant_isolation" on public.tenant_modules;
create policy "tenant_modules_tenant_isolation"
  on public.tenant_modules for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
