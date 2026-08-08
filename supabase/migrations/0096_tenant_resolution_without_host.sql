-- Faz 25 Adım 1 — subdomain'siz tenant çözümleme, cihaz halkası.
--
-- BAĞLAM: tenant kimliği bugün yalnızca Host başlığından çözülüyor
-- (proxy.ts → resolve_tenant_by_domain). Vercel'in *.vercel.app joker
-- sertifikası tek etiket kapsadığı için tenant subdomain'i TLS'te düşüyor ve
-- /waiter/login ile /vardiya/kurulum production'da kullanılamıyor. Bu iki
-- yüzey oturumsuz açıldığı için tenant'ı JWT'den de alamıyor — geriye
-- doğrulanmış CİHAZ kimliği kalıyor, bu migration onu sağlıyor.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) resolve_tenant_by_device — cihazdan tenant, O(1)
-- ─────────────────────────────────────────────────────────────────────────
-- NEDEN device_id PARAMETRESİ VAR: ilk tasarım imzası
-- resolve_tenant_by_device_secret(p_secret) idi, yani tenant filtresi yoktu.
-- 0070'in verify_staff_device yorumu tenant kapsamının neden gerekli
-- olduğunu zaten yazmış: "tenant içindeki aktif cihazlar arasında crypt() ile
-- eşleşen taranır (tenant başına personel cihaz sayısı küçük, performans
-- sorunu değil)". Filtre kalkınca o cümle geçersiz oluyor: crypt() bcrypt'tir
-- ve kasıtlı olarak yavaştır (~50-100ms). Platform genelinde tarama
-- 100 tenant × 5 cihaz = 500 bcrypt ≈ 30 saniye eder ve müşteri sayısıyla
-- doğrusal kötüleşir.
--
-- Çözüm 0070'in kendi teşhisini ortadan kaldırıyor. O yorum "kurulum tarafı
-- device_id'yi baştan bilemez" diyordu; artık biliyor:
--   • eşlenmiş cihazda  → rkys_device_id cookie'sinde duruyor (deviceAuth.ts)
--   • ilk eşlemede      → anahtar <deviceId>.<secret> biçiminde veriliyor (2)
-- Tek satır okunur, tek bcrypt yapılır, süre tenant sayısından bağımsızdır.
create or replace function public.resolve_tenant_by_device(p_device_id uuid, p_secret text)
returns uuid
language sql
security definer
set search_path = public, extensions
as $$
  select tenant_id
  from public.staff_devices
  where id = p_device_id
    and is_active = true
    and device_secret_hash = crypt(p_secret, device_secret_hash);
$$;

-- anon'a AÇILMAZ: /waiter/login ve /vardiya çağrılarını sunucu tarafında
-- service-role istemcisiyle yapıyor (waiter/login/actions.ts,
-- vardiya/actions.ts). verify_staff_device ile aynı yetki deseni.
revoke all on function public.resolve_tenant_by_device(uuid, text) from public;
grant execute on function public.resolve_tenant_by_device(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) create_staff_device — anahtar artık <deviceId>.<secret>
-- ─────────────────────────────────────────────────────────────────────────
-- Gösterilen anahtara cihaz id'si önek olarak ekleniyor ki ilk eşleme de (1)
-- deki O(1) aramayı kullanabilsin. Ayırıcı olarak "." güvenli: secret
-- base64 (encode(gen_random_bytes(24),'base64')) ve base64 alfabesi nokta
-- üretmez, yani split_part ile ayrıştırma tek anlamlıdır.
--
-- GERİYE UYUMLULUK: eşlenmiş cihazlar etkilenmez — onların cookie'sinde
-- deviceId zaten ayrı duruyor. Yalnızca bu migration'dan ÖNCE gösterilip
-- HENÜZ kullanılmamış anahtarlar geçersiz kalır (önek taşımıyorlar).
-- Kurtarma yolu (3)'teki yenileme eylemi.
create or replace function public.create_staff_device(p_branch_id uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_device_id uuid;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;

  v_secret := encode(gen_random_bytes(24), 'base64');

  insert into public.staff_devices (tenant_id, branch_id, device_label, device_secret_hash)
  values (public.current_tenant_id(), p_branch_id, p_label, crypt(v_secret, gen_salt('bf')))
  returning id into v_device_id;

  return v_device_id::text || '.' || v_secret;
end;
$$;
revoke all on function public.create_staff_device(uuid, text) from public;
grant execute on function public.create_staff_device(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) regenerate_staff_device_secret — kaybedilen anahtarın kurtarma yolu
-- ─────────────────────────────────────────────────────────────────────────
-- Anahtar admin ekranında yalnızca bir kez gösteriliyor ve hash'li saklandığı
-- için (RULES #29) sunucu da bilmiyor. Bugün kapatma düğmesine basıldığı an
-- geri getirmenin HİÇBİR yolu yok; kullanıcının tek çıkışı cihazı silip
-- yeniden oluşturmak ve bu hiçbir yerde yazmıyor. Aynı eylem cihaz
-- kaybolduğunda/çalındığında da doğru davranış.
create or replace function public.regenerate_staff_device_secret(p_device_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;

  v_secret := encode(gen_random_bytes(24), 'base64');

  -- tenant_id kapısı: current_tenant_id() ile eşleşmeyen bir cihaz id'si
  -- verilse bile satır güncellenmez ve fonksiyon null döner.
  update public.staff_devices
  set device_secret_hash = crypt(v_secret, gen_salt('bf'))
  where id = p_device_id
    and tenant_id = public.current_tenant_id();

  if not found then
    return null;
  end if;

  return p_device_id::text || '.' || v_secret;
end;
$$;
revoke all on function public.regenerate_staff_device_secret(uuid) from public;
grant execute on function public.regenerate_staff_device_secret(uuid) to authenticated;
