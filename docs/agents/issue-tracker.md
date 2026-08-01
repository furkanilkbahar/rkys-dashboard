# Issue Tracker — PLAN.md-entegre (özel)

Bu repo GitHub Issues **kullanmaz**. Tek doğru kaynak `PLAN.md`'dir (bkz. `CLAUDE.md` Çalışma Şekli #2-3); bir GitHub Issues akışı bununla senkronize olmayan ikinci bir kaynak yaratacağından bilinçli olarak devre dışı bırakıldı.

`to-spec`, `to-tickets`, `triage`, `code-review` gibi skill'ler için "issue tracker" karşılığı:

## Spec'ler (`/to-spec` çıktısı)

İlgili `PLAN.md` Faz bölümüne bir alt başlık olarak eklenir (`## Faz N — <isim>` altına). Faz henüz `PLAN.md`'de yoksa, önce `PLAN.md`'ye yeni bir Faz bölümü olarak açılır. Ürün düzeyinde kapsam değişikliği varsa ilgili `vault/20-mimari` ürün notu da güncellenir (`PRD.md` içeriği 2026-08-01'de vault'a taşındı). `ready-for-agent` triage etiketi uygulanmaz — bu repoda "hazır" durumu, Adım'ın "Blocked by" listesinin tamamlanmış olmasıyla ifade edilir (aşağıya bakın).

## Ticket'lar (`/to-tickets` çıktısı)

Ayrı dosyalar (`.scratch/<feature>/issues/*.md`) açılmaz. Bunun yerine, ilgili Faz'ın `PLAN.md` bölümünde mevcut checkbox/Adım formatına uyan bir liste olarak yazılır:

```markdown
- [ ] Adım N — <başlık>
      Blocked by: Adım M (veya "Yok — hemen başlanabilir")
      Kabul kriterleri: ...
```

Bir Adım, "Blocked by" listesindeki tüm Adımlar işaretlenince **frontier**'a girer (alınabilir hale gelir) — GitHub'daki native blocking ilişkisinin yerini bu sıralı checkbox listesi tutar. Tamamlanan Adımlar `CLAUDE.md` Çalışma Şekli #3 gereği işaretlenir.

## Dış (external) talepler

Bu proje şu an solo geliştiriliyor; dışarıdan gelen bug/PR yok. İleride GitHub üzerinden dışarıdan bir issue/PR gelirse, `triage` skill'i o **spesifik** issue için GitHub'ın kendi etiket mekanizmasını kullanabilir (bkz. `triage-labels.md`) — ama bu, projenin kendi iç planlamasını (yukarıdaki PLAN.md akışı) değiştirmez, ikisi paralel çalışır.

## PR'lar

Uygulanmaz — bu repo external PR akışını kullanmıyor (flag kapalı).
