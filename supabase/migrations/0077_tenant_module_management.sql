-- Faz 4 revizyonu Adım 4: platform admin tenant başına elle modül yönetimi
-- (S53). suspend_tenant (0037) deseninin klonu — platform admin serbestçe
-- aç/kapa yapabilir ve kaynağı (source) etiketleyebilir; is_enabled/source
-- birlikte upsert edilir ki bir modülü kapatırken kaynağını yanlışlıkla
-- değiştirmesin (çağıran taraf mevcut source'u okuyup aynen geri gönderir).
create or replace function public.set_tenant_module(
  p_tenant_id uuid,
  p_module_key text,
  p_is_enabled boolean,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  insert into public.tenant_modules (tenant_id, module_key, is_enabled, source)
  values (p_tenant_id, p_module_key, p_is_enabled, p_source)
  on conflict (tenant_id, module_key)
  do update set is_enabled = excluded.is_enabled, source = excluded.source, updated_at = now();
end;
$$;
revoke all on function public.set_tenant_module(uuid, text, boolean, text) from public;
grant execute on function public.set_tenant_module(uuid, text, boolean, text) to authenticated;
