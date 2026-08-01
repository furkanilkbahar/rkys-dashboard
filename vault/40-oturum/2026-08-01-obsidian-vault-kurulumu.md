---
tags: [oturum, obsidian, vault, dokumantasyon]
ozet: "Proje klasoru Obsidian vault olarak yapilandirildi ve tum proje bilgisi vault'a 'proje beyni' olarak aktarildi."
guncelleme: 2026-08-01
---

# Oturum — Obsidian Vault Kurulumu & Proje Beyni Aktarimi

## Bolum 1 — Vault iskeleti
`vault/00-index`, `10-runbook`, `20-mimari`, `30-kararlar`, `40-oturum` klasorleri acildi. `.obsidian/app.json`: gercekten var olan build/bagimlilik klasorleri (`node_modules/`, `.next/`, `.vercel/`, `test-results/`) `userIgnoreFilters`'a yazildi (onceki bozuk/hayali liste duzeltildi), `alwaysUpdateLinks`/`newLinkFormat`/`newFileLocation`/`newFileFolderPath` eklendi. `.gitignore`'a `.obsidian/workspace*.json` + `.obsidian/cache`. CLAUDE.md'nin EN USTUNE "Bilgi Erisim Protokolu" bloğu eklendi: agent once INDEX.md'yi okur, ilgili notu secer, index'te yoksa `obsidian search`, o da yoksa kodu tarayip vault'a not yazar — proje geneli `grep -r`/`find .` YASAK.

## Bolum 2 — Proje beyni aktarimi (bu oturum)
Kullanicinin tercihi (AskUserQuestion ile alindi): (1) PRD/ARCHITECTURE/OPERATIONS/TESTING.md icerigi vault'a TASINDI, kok dosyalar kisa yonlendirme notuna donustu ("vault birincil, kok ozet"); (2) DECISIONS.md'nin 87 karari (D1-D87) icin "her ana bilesen icin ayri not" istendi, max 80 satir + frontmatter (tags/ozet/guncelleme) formatiyla.

Sonuc: 14 mimari + 7 runbook + 6 karar notu (toplam 27) olusturuldu. DECISIONS.md/PLAN.md/RULES.md kok dizinde DEGISMEDEN kaldi (aktif "tek dogru kaynak" — issue-tracker.md ve CLAUDE.md'nin kendi sapma kurallari geregi). TESTING.md'nin yasayan E2E senaryo tablosu (S1-S55+) [[e2e-senaryolari]]'na tasindi ve artik orasi buyumeye devam ediyor.

## Onemli sapma (Varsayim olarak uygulandi)
`docs/environments.md` de (Q1 kapsaminda acikca sorulmamis olsa da) OPERATIONS.md ile birebir bagli oldugu icin ayni sekilde stub'a cevrildi, icerigi [[ortamlar-ve-deploy]]'a katildi — tutarlilik icin.

## Baglantili notlar
[[INDEX]]
