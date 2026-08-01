---
tags: [mimari, garson, mutfak, kds, realtime]
ozet: "Garson paneli ve KDS: gercek zamanli cagri/siparis akisi, personel yuzeyleri."
guncelleme: 2026-08-01
---

# Garson Paneli & KDS (Mutfak)

## Ne ise yarar
Sahadaki personelin gercek zamanli calisma yuzeyleri; musteri deneyiminin operasyonel karsiligi.

## Nasil calisir
- **Garson Paneli:** cagrilar (open -> ack -> resolved, yanit suresi), onay/iptal kuyrugu, hazir siparisler, masa haritasi, masa tasima (yalniz `session.move` izinli personel), rezervasyon gorunumu (modul aciksa).
- **KDS:** kanal etiketli siparis kartlari, sure/gecikme renkleri, `preparing -> ready`; istasyon altyapisi (`station` kolonu) semada hazir, istasyon ekranlari kendi fazinda acildi (Faz 6).
- **Realtime:** `orders`, `order_items`, `waiter_calls`, `table_sessions`, `reservations` tenant+branch kanalli Supabase Realtime abonelikleri.
- **Dayaniklilik (bug-hunt D87 sonrasi):** `waiter-panel.tsx` artik yalniz postgres_changes event'ine guvenmiyor — `refetchWaiterPanel` server action'i ile incremental state refetch (SUBSCRIBED olur olmaz + 5sn polling, session-panel.tsx'teki D30 desenine paralel) kacan/gecikmis event'i telafi ediyor; eskiden her event'te tam sayfa `window.location.reload()` yapiliyordu (ses tercihini de sifirliyordu).
- **Girisr:** garson/mutfak vardiya modu + PIN, bkz. [[kimlik-rol-izin]] (D87 bagimsiz oturum).

## Ilgili kod
`src/app/(waiter)/waiter`, `src/app/(kitchen)/kitchen`, `src/lib/realtime`, `tests/e2e/staff/waiter-call-realtime.spec.ts`.

## Ilgili kararlar
D4 (3 personel yuzeyi), D28 (israrci ses), D35 (cagri tipleri), D37 (istasyon semasi). Bilinen kirilganlik gecmisi: [[test-stratejisi]] §Bilinen Test Acıklari.

## Baglantili notlar
[[qr-menu-siparis]] · [[kimlik-rol-izin]]
