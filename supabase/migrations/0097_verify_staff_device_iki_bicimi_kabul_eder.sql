-- 0096 DÜZELTMESİ — geçişi iki yönde de güvenli hale getirir.
--
-- HATA: 0096 create_staff_device'ın DÖNÜŞ BİÇİMİNİ değiştirdi (artık
-- "<deviceId>.<secret>"), ama o değeri tüketen kod hâlâ eski biçimi
-- varsayıyor: setupDevice (vardiya/actions.ts:16) dizeyi olduğu gibi
-- verify_staff_device'a veriyor, crypt eşleşmiyor ve kullanıcıya "geçersiz
-- anahtar" deniyor. Yani 0096 TEK BAŞINA cihaz kurulumunu bozuyor.
-- "Migration'a bağımlı kod yok" varsayımı yanlıştı — kod migration'ın
-- ÇIKTISINI tüketiyordu.
--
-- Üretim etkilenmedi: migrate-production job'ı e2e'ye bağlı, e2e kırmızıydı,
-- 0096 üretime hiç uygulanmadı.
--
-- ÇÖZÜM (geri alma DEĞİL): verify_staff_device her iki biçimi de kabul eder.
-- Böylece eski istemci kodu yeni anahtarla, yeni istemci kodu eski anahtarla
-- çalışır ve geçiş sırasında hiçbir an kırık kalmaz (strangler-fig).
-- Önekli biçimde arama zaten O(1) yoluna düşer; öneksizde 0070'in tenant
-- kapsamlı taraması korunur.
create or replace function public.verify_staff_device(p_tenant_id uuid, p_secret text)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
  v_prefix text;
  v_rest text;
begin
  -- "<uuid>.<secret>" biçimi mi? Ayırıcı "." güvenli: secret base64 ve
  -- base64 alfabesi nokta üretmez.
  if position('.' in p_secret) > 0 then
    v_prefix := split_part(p_secret, '.', 1);
    -- secret'ın kendisi base64 olduğu için "=" dolgusu içerebilir; yalnızca
    -- İLK noktadan böl, gerisini olduğu gibi al.
    v_rest := substr(p_secret, position('.' in p_secret) + 1);

    -- Geçersiz uuid önekinde patlamak yerine null dönülür: kullanıcı yanlış
    -- bir dize yapıştırmış olabilir, bu bir istisna değil "eşleşme yok".
    begin
      select id into v_device_id
      from public.staff_devices
      where id = v_prefix::uuid
        and tenant_id = p_tenant_id
        and is_active = true
        and device_secret_hash = crypt(v_rest, device_secret_hash);
    exception when invalid_text_representation then
      v_device_id := null;
    end;

    if v_device_id is not null then
      return v_device_id;
    end if;
  end if;

  -- Öneksiz (0070) biçim: tenant kapsamlı tarama. Önekli dize buraya
  -- düşerse de zararsız — eşleşme bulunmaz, null döner.
  select id into v_device_id
  from public.staff_devices
  where tenant_id = p_tenant_id
    and is_active = true
    and device_secret_hash = crypt(p_secret, device_secret_hash)
  limit 1;

  return v_device_id;
end;
$$;
revoke all on function public.verify_staff_device(uuid, text) from public;
grant execute on function public.verify_staff_device(uuid, text) to service_role;
