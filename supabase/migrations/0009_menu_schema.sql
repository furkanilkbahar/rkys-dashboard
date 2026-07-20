-- Menü kataloğu tenant seviyesinde merkezi yönetilir (D40); şube-özel
-- davranış branch_product_overrides'ta yaşar (RULES #33 o tabloyla
-- karşılanır). SELECT tüm tenant_id eşleşenlere açıktır (personel VE Faz 1
-- Adım 2'den itibaren misafir menüyü okuyabilmeli); yazma yalnızca personel.

create table public.tenant_locales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  locale text not null check (locale in ('tr', 'en')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, locale)
);
create index idx_tenant_locales_tenant_id on public.tenant_locales(tenant_id);
alter table public.tenant_locales enable row level security;
create policy "tenant_locales_select" on public.tenant_locales for select
  using (tenant_id = public.current_tenant_id());
create policy "tenant_locales_staff_write" on public.tenant_locales for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.tenant_locales to authenticated, service_role;

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  layout text not null default 'grid' check (layout in ('grid', 'list', 'showcase')), -- D14
  station text, -- şema-only: istasyon ekranları Faz 5
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_menu_categories_tenant_id on public.menu_categories(tenant_id);
alter table public.menu_categories enable row level security;
create policy "menu_categories_select" on public.menu_categories for select
  using (tenant_id = public.current_tenant_id());
create policy "menu_categories_staff_write" on public.menu_categories for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.menu_categories to authenticated, service_role;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  track_mode text not null default 'simple' check (track_mode in ('simple', 'recipe')), -- recipe mantığı şema-only: Faz 8
  base_price_minor integer not null check (base_price_minor >= 0), -- kuruş
  stock_quantity integer, -- null = takipsiz; varyantı olan üründe kullanılmaz
  is_sold_out boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_tenant_id on public.products(tenant_id);
create index idx_products_category_id on public.products(category_id);
alter table public.products enable row level security;
create policy "products_select" on public.products for select
  using (tenant_id = public.current_tenant_id());
create policy "products_staff_write" on public.products for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.products to authenticated, service_role;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price_minor integer not null check (price_minor >= 0), -- delta değil, nihai fiyat
  stock_quantity integer,
  is_sold_out boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_product_variants_tenant_id on public.product_variants(tenant_id);
create index idx_product_variants_product_id on public.product_variants(product_id);
alter table public.product_variants enable row level security;
create policy "product_variants_select" on public.product_variants for select
  using (tenant_id = public.current_tenant_id());
create policy "product_variants_staff_write" on public.product_variants for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.product_variants to authenticated, service_role;

create table public.product_extras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price_minor integer not null default 0 check (price_minor >= 0),
  stock_quantity integer,
  is_sold_out boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_product_extras_tenant_id on public.product_extras(tenant_id);
create index idx_product_extras_product_id on public.product_extras(product_id);
alter table public.product_extras enable row level security;
create policy "product_extras_select" on public.product_extras for select
  using (tenant_id = public.current_tenant_id());
create policy "product_extras_staff_write" on public.product_extras for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.product_extras to authenticated, service_role;

-- branch_product_overrides: gerçek şube-operasyonel veri (RULES #33).
create table public.branch_product_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade, -- null = ürün seviyesi override
  price_minor integer, -- null = kalıt
  is_available boolean not null default true, -- false = "bu şubede satılmıyor"
  stock_quantity integer, -- null = kalıt
  is_sold_out boolean, -- null = kalıt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, product_id, variant_id)
);
create unique index idx_branch_overrides_product_level
  on public.branch_product_overrides (branch_id, product_id) where variant_id is null;
create index idx_branch_product_overrides_tenant_id on public.branch_product_overrides(tenant_id);
alter table public.branch_product_overrides enable row level security;
create policy "branch_product_overrides_select" on public.branch_product_overrides for select
  using (tenant_id = public.current_tenant_id());
create policy "branch_product_overrides_staff_write" on public.branch_product_overrides for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.branch_product_overrides to authenticated, service_role;

-- content_translations: tenant İÇERİĞİ için DB-seviyeli i18n (next-intl'in
-- UI JSON'undan bilinçli olarak ayrı — kategori/ürün/varyant/ekstra/çağrı
-- tipi isimleri tenant'ın kendi verisidir, koda gömülmez, dosyaya da değil).
create table public.content_translations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (entity_type in
    ('menu_category', 'product', 'product_variant', 'product_extra', 'call_type')),
  entity_id uuid not null,
  locale text not null check (locale in ('tr', 'en')),
  field text not null check (field in ('name', 'description')),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, locale, field)
);
create index idx_content_translations_tenant_id on public.content_translations(tenant_id);
create index idx_content_translations_entity on public.content_translations(entity_type, entity_id);
alter table public.content_translations enable row level security;
create policy "content_translations_select" on public.content_translations for select
  using (tenant_id = public.current_tenant_id());
create policy "content_translations_staff_write" on public.content_translations for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.content_translations to authenticated, service_role;
