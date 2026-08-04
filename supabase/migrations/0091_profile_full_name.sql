-- Faz 23 (D94): profiles.full_name
--
-- NEDEN: `/admin/staff` üye listesi tabloya alınamıyordu çünkü satırların
-- KİMLİK KOLONU yoktu — `profiles` yalnızca rol, rozet no, PIN ve durum
-- tutuyor, e-posta ise `auth.users`'ta ve RLS altında okunamıyor. Sonuç:
-- 8 personel yalnızca rozet numarasıyla ayırt ediliyordu, rozetsiz bir
-- personel hiç ayırt edilemiyordu.
--
-- Nullable bırakıldı: D87 ile açılan mevcut personelin adı yok ve bu
-- migration onları geçersiz kılmamalı. UI ada düşemediğinde rozete, o da
-- yoksa role düşer (ingredients'taki "uydurma yok" deseniyle aynı: eksik
-- veri sahte bir değerle doldurulmaz).
alter table public.profiles add column if not exists full_name text;

-- update_staff_member'ın 5 argümanlı sürümü. ESKİ 4 ARGÜMANLI SÜRÜM
-- BIRAKILDI (silinmedi): migration ile uygulama dağıtımı arasındaki kısa
-- pencerede eski kod hâlâ onu çağırabilir (strangler kuralı, RULES #22).
-- Yeni çağrıların tamamı bu sürüme gider; eski sürüm bir sonraki temizlik
-- migration'ında düşürülebilir.
create or replace function public.update_staff_member(
  p_profile_id uuid,
  p_role text,
  p_badge_no text,
  p_is_active boolean,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_role text;
  v_actor_role text := public.current_role();
  v_owner_count integer;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;

  select role into v_current_role from public.profiles
  where id = p_profile_id and tenant_id = public.current_tenant_id()
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  if p_role = 'owner' and v_current_role <> 'owner' and v_actor_role <> 'owner' then
    raise exception 'only an owner can grant the owner role';
  end if;

  -- Son owner'ı düşürme/pasifleştirme koruması 0026'daki ile birebir aynı;
  -- yeni kolon bu kuralı değiştirmez.
  if v_current_role = 'owner' and (p_role <> 'owner' or not p_is_active) then
    select count(*) into v_owner_count from public.profiles
    where tenant_id = public.current_tenant_id() and role = 'owner' and is_active;

    if v_owner_count <= 1 then
      raise exception 'cannot demote or deactivate the last owner';
    end if;
  end if;

  perform set_config('rkys.allow_profile_escalation', 'true', true);
  update public.profiles
  set role = p_role,
      badge_no = p_badge_no,
      is_active = p_is_active,
      -- Boş dize NULL'a çevrilir: "adı yok" tek bir biçimde temsil edilsin,
      -- liste sıralaması ve boş-değer kontrolleri iki ayrı hâl aramasın.
      full_name = nullif(btrim(coalesce(p_full_name, '')), '')
  where id = p_profile_id and tenant_id = public.current_tenant_id();
end;
$$;
revoke all on function public.update_staff_member(uuid, text, text, boolean, text) from public;
grant execute on function public.update_staff_member(uuid, text, text, boolean, text) to authenticated;
