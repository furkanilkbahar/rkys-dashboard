-- Faz 7 Adım 0: müşteri kimliği — telefon+OTP + KVKK onayı (S30).
-- Bilinçli tasarım kararı: Supabase Auth'un telefon/OTP sağlayıcısı
-- KULLANILMAZ — verifyOtp() tarayıcının aktif oturumunu YENİ bir auth
-- kullanıcısına değiştirir, bu da misafirin table_session_id claim'ini
-- (dolayısıyla sipariş/ödeme akışını) kaybetmesine yol açardı. Bunun yerine
-- OTP tamamen uygulama seviyesinde: misafirin MEVCUT oturumu hiç değişmeden,
-- yalnızca o oturuma bir customer_id bağlanır (ARCHITECTURE.md'nin "oturum
-- harcamaları müşteriye bağlanır" tarifiyle birebir). Bu yüzden
-- custom_access_token_hook'a hiç dokunulmaz, is_staff()'e yeni bir rol
-- değeri eklenmez (eklenseydi is_staff()'in "current_role() <> 'guest'"
-- tanımı müşterileri de staff sayardı — düzinelerce RLS politikasında
-- yetki sızıntısı olurdu).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone text not null,
  kvkk_consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);
create index idx_customers_tenant_id on public.customers(tenant_id);
alter table public.customers enable row level security;
-- Misafir/müşteri tarafı kendi bilgisini doğrudan bu tablodan sorgulamaz
-- (RPC'lerin döndürdüğü değerle yetinir) — yalnızca staff (RULES #38: telefon
-- UI'da maskeli gösterilir, bu maskeleme TS katmanında yapılır).
create policy "customers_select" on public.customers for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.customers to authenticated;
grant all on public.customers to service_role;

-- Ham kod asla saklanmaz, yalnızca hash'i (tables.qr_token_hash ile aynı
-- desen) — kısa ömürlü (5dk) ve tek kullanımlık (consumed_at). RLS
-- politikası YOK: bu tabloya yalnızca aşağıdaki SECURITY DEFINER RPC'ler
-- üzerinden erişilir, doğrudan API/PostgREST erişimi tamamen kapalı.
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_otp_codes_tenant_phone on public.otp_codes(tenant_id, phone);
alter table public.otp_codes enable row level security;

-- customer_segments: kullanımı Faz 12 (segmentli kampanya + İYS iletişimi,
-- D50) — ARCHITECTURE.md §4'ün "CRM & Pazarlama" tablo grubunda önceden
-- belgelenmiş, "şema kapısı" ilkesiyle (PLAN.md) burada erken açılıyor.
-- Bu fazda hiçbir RPC/UI dokunmuyor.
create table public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_customer_segments_tenant_id on public.customer_segments(tenant_id);
alter table public.customer_segments enable row level security;
create policy "customer_segments_select" on public.customer_segments for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.customer_segments to authenticated;
grant all on public.customer_segments to service_role;

alter table public.table_sessions add column customer_id uuid references public.customers(id) on delete set null;

-- Mock SMS sağlayıcısının (lib/integrations/sms/mock.ts) gönderdiği kodu
-- kaydettiği tablo — sent_emails (Faz 5) ile aynı gerekçe: gerçek sağlayıcı
-- seçilene kadar (D66) testlerin/geliştirmenin "gönderilen" içeriği
-- görebilmesi için. body (OTP kodu dahil) yalnızca mock sağlayıcı düz metin
-- yazdığı için var — gerçek bir sağlayıcı eklendiğinde bu tabloya hiç
-- yazılmaz (yalnızca lib/integrations/sms/mock.ts kullanır).
create table public.sent_sms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone text not null,
  body text not null,
  provider text not null,
  created_at timestamptz not null default now()
);
create index idx_sent_sms_tenant_id on public.sent_sms(tenant_id);
alter table public.sent_sms enable row level security;
create policy "sent_sms_select" on public.sent_sms for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.sent_sms to authenticated;
grant select, insert, update, delete on public.sent_sms to service_role;

-- request_loyalty_otp: yalnızca misafir, KENDİ oturumu için çağırabilir
-- (apply_coupon_to_order'ın current_table_session_id() deseniyle aynı).
-- Kod üretimi/hash'lemesi TS katmanında yapılır (SMS'e ham kodu göndermesi
-- gerektiği için) — burada yalnızca hash saklanır, rate limit uygulanır.
create or replace function public.request_loyalty_otp(p_table_session_id uuid, p_phone text, p_code_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_recent_count integer;
begin
  if public.current_role() <> 'guest' or public.current_table_session_id() is distinct from p_table_session_id then
    raise exception 'guest table session required';
  end if;

  select tenant_id into v_tenant_id from public.table_sessions where id = p_table_session_id and status = 'active';
  if v_tenant_id is null then
    raise exception 'table session is not active';
  end if;

  -- Yalnızca TS katmanına değil, RPC'ye de modül kapısı (apply_coupon_to_order,
  -- 0051, ile aynı gerekçe — kişisel veri toplayan/SMS gönderen bir RPC'nin
  -- yalnızca UI'da gizlenmesi yeterli değil).
  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'crm_loyalty' and is_enabled = true
  ) then
    raise exception 'crm_loyalty module not enabled';
  end if;

  select count(*) into v_recent_count
  from public.otp_codes
  where tenant_id = v_tenant_id and phone = p_phone and created_at > now() - interval '5 minutes';
  if v_recent_count >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.otp_codes (tenant_id, phone, code_hash, expires_at)
  values (v_tenant_id, p_phone, p_code_hash, now() + interval '5 minutes');
end;
$$;
revoke all on function public.request_loyalty_otp(uuid, text, text) from public;
grant execute on function public.request_loyalty_otp(uuid, text, text) to authenticated;

-- verify_loyalty_otp: kodu doğrular, KVKK onayı zorunlu (yoksa reddeder),
-- customers'ı upsert eder (aynı telefon+tenant zaten varsa dokunmaz — ilk
-- onay zamanı korunur), oturuma bağlar. customer_id döner.
create or replace function public.verify_loyalty_otp(
  p_table_session_id uuid,
  p_phone text,
  p_code_hash text,
  p_kvkk_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_otp record;
  v_customer_id uuid;
begin
  if public.current_role() <> 'guest' or public.current_table_session_id() is distinct from p_table_session_id then
    raise exception 'guest table session required';
  end if;
  if not p_kvkk_consent then
    raise exception 'kvkk consent required';
  end if;

  select tenant_id into v_tenant_id from public.table_sessions where id = p_table_session_id and status = 'active' for update;
  if v_tenant_id is null then
    raise exception 'table session is not active';
  end if;

  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'crm_loyalty' and is_enabled = true
  ) then
    raise exception 'crm_loyalty module not enabled';
  end if;

  select * into v_otp
  from public.otp_codes
  where tenant_id = v_tenant_id and phone = p_phone and code_hash = p_code_hash
    and expires_at > now() and consumed_at is null
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'invalid or expired code';
  end if;

  update public.otp_codes set consumed_at = now() where id = v_otp.id;

  insert into public.customers (tenant_id, phone, kvkk_consented_at)
  values (v_tenant_id, p_phone, now())
  on conflict (tenant_id, phone) do nothing;

  select id into v_customer_id from public.customers where tenant_id = v_tenant_id and phone = p_phone;

  update public.table_sessions set customer_id = v_customer_id where id = p_table_session_id;

  return v_customer_id;
end;
$$;
revoke all on function public.verify_loyalty_otp(uuid, text, text, boolean) from public;
grant execute on function public.verify_loyalty_otp(uuid, text, text, boolean) to authenticated;
