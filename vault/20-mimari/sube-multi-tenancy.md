---
tags: [mimari, multi-tenancy, sube, guvenlik]
ozet: "Tenant ve sube cozumleme katmani + RLS temelli izolasyon garantisi."
guncelleme: 2026-08-01
---

# Sube (Branch) & Multi-Tenancy Katmani

## Ne ise yarar
Platformun temel izolasyon birimi: her tenant bagimsiz bir isletme, her tenant icinde 1+ sube.

## Nasil calisir
- **Tenant cozumleme:** middleware subdomain -> `tenant_id`; `tenant_domains` ile custom domain kapisi.
- **Sube cozumleme:** oturumdaki aktif `branch_id`; tek subeli tenant'ta otomatik ve gorunmez (migration gerektirmez, ikinci sube acilinca secici belirir).
- **Merkezi menu + override:** menu tenant seviyesinde tek yerden yonetilir; `branch_product_overrides` ile sube bazli fiyat/stok/satilmiyor farki.
- **RLS zorunlu:** her tabloda `tenant_id` (+operasyonelde `branch_id`); personel JWT claim (`tenant_id`, `user_role`); musteri anon yazmalari yalniz imzali token'li RPC/Edge Fn; Super Admin ayri claim; `service_role` yalniz server.
- **Cift katman limit:** plan masa/sube limiti UI + DB (trigger/RPC) ikisinde de uygulanir.
- **2FA:** TOTP altyapisi hazir; zorunluluk `platform_settings.enforce_2fa` ile Super Admin kontrolunde (varsayilan opsiyonel).

## Veri modeli
`tenants`, `tenant_domains`, `branches`, `profiles` (rol, badge_no, pin_hash), `staff_branch_assignments`, `staff_devices`, `role_permissions`, `tenant_modules`.

## Ilgili kod
`middleware.ts` / `proxy.ts` (tenant+sube cozumleme), `src/lib/supabase`, `src/lib/auth`, `supabase/migrations/*` (RLS politikalari).

## Ilgili kararlar
D3 (bastan multi-tenant SaaS), D39 (sube semasi + gizli tek sube), D40 (merkezi menu + override), D41 (plan-sube fiyatlandirma). Kesin kurallar: RULES.md §Guvenlik & Multi-Tenancy (1-8), §v3.0 madde 33/34.

## Baglantili notlar
[[kimlik-rol-izin]] · [[modul-sistemi]] · [[qr-menu-siparis]]
