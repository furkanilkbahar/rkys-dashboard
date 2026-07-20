-- Faz 2 Adım 3: menü görselleri. Bucket migration ile tanımlanır (RULES:
-- şema değişikliği yalnızca migration — dashboard'dan elle değil), bu yüzden
-- lokal + Cloud'da birebir aynı. Menü fotoğrafları hassas değil ve misafir
-- zaten kimliksiz okuyor (Faz 1) — bucket public-read, yalnızca yazma
-- tenant-prefixed path + is_staff() ile korunur.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "menu_images_staff_write"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "menu_images_staff_update"
  on storage.objects for update
  using (
    bucket_id = 'menu-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "menu_images_staff_delete"
  on storage.objects for delete
  using (
    bucket_id = 'menu-images'
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

alter table public.products add column image_url text;
alter table public.menu_categories add column image_url text;

-- Tenant galerisi: personelin daha önce yüklediği görselleri farklı
-- ürünlerde tekrar seçebilmesi için ("hazır kütüphane" — kullanıcı onayıyla
-- platform media_library yerine tenant-scoped basit galeri, D-D).
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_product_images_tenant_id on public.product_images(tenant_id);
alter table public.product_images enable row level security;
create policy "product_images_select" on public.product_images for select
  using (tenant_id = public.current_tenant_id());
create policy "product_images_staff_write" on public.product_images for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.product_images to authenticated, service_role;
