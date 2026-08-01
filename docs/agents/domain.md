# Domain Docs — Layout ve Tüketici Kuralları

**Layout: single-context.** Bu repo bir monorepo değil (pnpm-workspace.yaml yalnızca `allowBuilds` içeriyor, gerçek `packages:` alanı yok) — tek `CONTEXT.md` + karar günlüğü yeterli.

## CONTEXT.md

Kök dizinde. Henüz oluşturulmadı — `domain-modeling` skill'i ilk terim netleştiğinde lazy şekilde oluşturur (örn. "sipariş" ile "sipariş kalemi" arasındaki sınır, "şube" vs "tenant" ayrımı gibi). Yalnızca sözlük; implementasyon detayı, spec veya karar içermez.

## ADR'lar — ÖNEMLİ REPO-ÖZEL SAPMA

`domain-modeling` skill'i varsayılan olarak `docs/adr/000X-....md` dosyaları oluşturmayı önerir. **Bu repoda kullanılmaz.** Bu proje zaten kendi karar günlüğüne sahip: `DECISIONS.md` (kök dizinde), D-numaralandırmasıyla (örn. D38, D75, D85...). `CLAUDE.md`: *"Bir davranışın gerekçesini merak edersen DECISIONS.md karar günlüğüne bak; kararları onaysız değiştirme."*

Bu yüzden:
- Hard-to-reverse / surprising-without-context / gerçek trade-off sonucu bir karar netleştiğinde, yeni bir `docs/adr/` dosyası **açma**.
- Bunun yerine mevcut `DECISIONS.md` formatına uyan yeni bir **D-numaralı** madde ekle (bir sonraki boş D numarasını kullan) ve kullanıcıdan onay iste — `DECISIONS.md`'ye yazmak zaten CLAUDE.md gereği onaya tabi bir işlem.
- `domain-modeling` skill'inin "offer an ADR" davranışı burada "DECISIONS.md'ye D-madde olarak eklemeyi öner" şeklinde okunmalı.

## Tüketici kuralı

Domain kelime dağarcığına ihtiyaç duyan her skill (`tdd`, `to-spec`, `to-tickets`, `code-review`, `diagnosing-bugs`, `improve-codebase-architecture`, `triage`...), varsa `CONTEXT.md`'yi okuyup terimleri oradan kullanır; hard-to-reverse kararlar için yukarıdaki sapmaya uyarak `DECISIONS.md`'ye yönlendirir.
