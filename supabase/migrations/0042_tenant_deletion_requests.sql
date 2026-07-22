-- Faz 4 Adım 6: veri silme akışı (D34, yasal set). Gerçek silme geri
-- dönüşü olmayan bir işlem olduğundan owner yalnızca bir TALEP oluşturur —
-- fiili silme Süper Admin tarafından manuel olarak (destek sürecinin bir
-- parçası olarak) yürütülür.
alter table public.tenants add column deletion_requested_at timestamptz;

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'owner' then
    raise exception 'owner only';
  end if;

  update public.tenants
  set deletion_requested_at = now()
  where id = public.current_tenant_id();
end;
$$;
revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;
