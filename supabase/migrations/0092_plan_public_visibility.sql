-- Faz 23 (D96): plans.is_public — pazarlama vitrini ile satın alınabilirliğin ayrılması
--
-- NEDEN: Süper Admin `create_plan` ile "Demo" gibi planlar açabiliyor ve bu
-- planlar ana sayfadaki fiyatlandırma tablosuna da düşüyordu. "Bir plan
-- SEÇİLEBİLİR mi?" ile "Bir plan VİTRİNDE mi?" iki ayrı soru; tek bir satırla
-- ikisini birden cevaplamak, demo/iç plan eklenir eklenmez pazarlama sayfasını
-- bozuyor. Kolon bu iki soruyu ayırıyor:
--   is_public = true  → ana sayfa fiyatlandırma tablosunda görünür
--   is_public = false → yalnızca kayıt formunda/atamada seçilebilir
--
-- Varsayılan `true`: mevcut üç plan (starter/pro/unlimited) vitrindeydi ve bu
-- migration onları gizlememeli.
alter table public.plans add column if not exists is_public boolean not null default true;

-- Mevcut demo/iç planlar vitrinden çekilir. `key` üzerinden eşleşiyoruz çünkü
-- `name` Süper Admin'den serbestçe düzenlenebilir; `key` ise 0074'te bilinçli
-- olarak değiştirilemez bırakıldı, yani kararlı olan taraf o.
update public.plans set is_public = false where key in ('demo', 'trial', 'internal');

-- create_plan/update_plan'ın is_public alan sürümleri. ESKİ 6 ARGÜMANLI
-- SÜRÜMLER BIRAKILDI (silinmedi): migration ile uygulama dağıtımı arasındaki
-- pencerede eski kod hâlâ onları çağırabilir (strangler kuralı, RULES #22).
-- Farklı arite olduğu için overload çözümü belirsiz değil.
create or replace function public.create_plan(
  p_key text,
  p_name text,
  p_price_minor integer,
  p_table_limit integer,
  p_included_branch_count integer,
  p_extra_branch_price_minor integer,
  p_is_public boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  insert into public.plans (
    key, name, price_minor, table_limit, included_branch_count, extra_branch_price_minor, is_public
  )
  values (
    p_key, p_name, p_price_minor, p_table_limit, p_included_branch_count, p_extra_branch_price_minor,
    coalesce(p_is_public, true)
  )
  returning id into v_plan_id;

  return v_plan_id;
end;
$$;
revoke all on function public.create_plan(text, text, integer, integer, integer, integer, boolean) from public;
grant execute on function public.create_plan(text, text, integer, integer, integer, integer, boolean) to authenticated;

create or replace function public.update_plan(
  p_plan_id uuid,
  p_name text,
  p_price_minor integer,
  p_table_limit integer,
  p_included_branch_count integer,
  p_extra_branch_price_minor integer,
  p_is_public boolean
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

  update public.plans
  set name = p_name,
      price_minor = p_price_minor,
      table_limit = p_table_limit,
      included_branch_count = p_included_branch_count,
      extra_branch_price_minor = p_extra_branch_price_minor,
      is_public = coalesce(p_is_public, true)
  where id = p_plan_id;

  if not found then
    raise exception 'plan not found';
  end if;
end;
$$;
revoke all on function public.update_plan(uuid, text, integer, integer, integer, integer, boolean) from public;
grant execute on function public.update_plan(uuid, text, integer, integer, integer, integer, boolean) to authenticated;
