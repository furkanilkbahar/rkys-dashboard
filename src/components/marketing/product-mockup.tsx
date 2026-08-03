/**
 * Faz 21 Adım 2 (§2.4) — hero ve bölünmüş içerik bölümlerinde kullanılan ürün
 * gösterimi.
 *
 * §2.4 "soyut illüstrasyon değil, ürünün kendisi" diyor. Bu bileşen ürünün
 * GERÇEK yüzey token'larını ve gerçek düzenini kullanan bir gösterimdir:
 * admin chrome'u `--surface-*`, misafir menüsü Gece temasının değerleriyle
 * çizilir — yani pazarlama sayfası ürünün renklerini birebir taşır ve tema
 * değişince otomatik takip eder.
 *
 * NOT: gerçek ekran görüntüsü (PNG) ile takas edilmesi planlanıyor; yerel
 * demo verisi E2E koşumlarıyla kirlendiği için (kategori/ürün tekrarları)
 * temiz görüntü üretilemedi. PLAN.md Faz 21'de takip maddesi var.
 *
 * Server Component — sıfır client JS.
 */

/** Yönetim paneli: sidebar + istatistik satırı + liste. */
export function AdminMockup({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden rounded-[var(--radius)] shadow-[var(--shadow-md)] ${className}`}
      style={{ backgroundColor: "oklch(0.19 0.008 240)" }}
    >
      <div className="flex h-7 items-center gap-1.5 px-3" style={{ backgroundColor: "oklch(0.16 0.008 240)" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-[7px] rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.16)" }} />
        ))}
      </div>

      <div className="grid grid-cols-[54px_1fr]" style={{ height: 280 }}>
        <div className="flex flex-col items-center gap-2 py-3" style={{ backgroundColor: "oklch(0.16 0.008 240)" }}>
          <span className="size-5 rounded-[6px]" style={{ backgroundColor: "var(--brand-300)" }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1.5 w-5 rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.13)" }} />
          ))}
        </div>

        <div className="p-4">
          <span className="block h-1.5 w-12 rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.1)" }} />
          <span className="mt-2 block h-3 w-24 rounded" style={{ backgroundColor: "oklch(1 0 0 / 0.16)" }} />

          <div className="mt-4 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-[8px] p-2" style={{ backgroundColor: "oklch(1 0 0 / 0.05)" }}>
                <span
                  className="block h-1.5 w-2/3 rounded-full"
                  style={{ backgroundColor: i === 0 ? "var(--brand-300)" : "oklch(1 0 0 / 0.13)" }}
                />
                <span className="mt-1.5 block h-2.5 w-3/4 rounded" style={{ backgroundColor: "oklch(1 0 0 / 0.16)" }} />
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-[8px] p-3" style={{ backgroundColor: "oklch(1 0 0 / 0.04)" }}>
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center gap-3 py-1.5">
                <span className="h-1.5 w-[14%] rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.13)" }} />
                <span className="h-1.5 w-[22%] rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.13)" }} />
                <span
                  className="h-1.5 w-[10%] rounded-full"
                  style={{ backgroundColor: row === 0 ? "var(--brand-300)" : "oklch(1 0 0 / 0.13)" }}
                />
                <span className="ml-auto h-1.5 w-[12%] rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.13)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Misafir QR menüsü — Gece temasının gerçek değerleriyle. */
export function MenuMockup({ className = "" }: { className?: string }) {
  const AMBER = "oklch(0.78 0.155 65)";
  const CARD = "oklch(0.22 0.016 55)";

  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden rounded-[18px] shadow-[var(--shadow-md)] ${className}`}
      style={{ backgroundColor: "oklch(0.15 0.012 55)", border: "1px solid oklch(1 0 0 / 0.14)" }}
    >
      <div className="p-3">
        <span className="block h-2 w-2/3 rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.16)" }} />

        <div className="mt-2.5 flex gap-1.5">
          <span className="h-4 w-14 rounded-full" style={{ backgroundColor: AMBER }} />
          <span className="h-4 w-14 rounded-full" style={{ backgroundColor: CARD }} />
          <span className="h-4 w-10 rounded-full" style={{ backgroundColor: CARD }} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            "linear-gradient(145deg,#8a5a2b,#c98b3f)",
            "linear-gradient(150deg,#3f5f36,#7a9a55)",
            "linear-gradient(140deg,#7a2f26,#b8563c)",
            "linear-gradient(160deg,#5c4632,#9c7a4e)",
          ].map((bg) => (
            <div key={bg} className="rounded-[10px] p-1.5" style={{ backgroundColor: CARD }}>
              <div className="rounded-[6px]" style={{ aspectRatio: "4 / 3", backgroundImage: bg }} />
              <span className="mt-1.5 block h-1.5 w-4/5 rounded-full" style={{ backgroundColor: "oklch(1 0 0 / 0.16)" }} />
              <span className="mt-1 block h-2 w-2/5 rounded-full" style={{ backgroundColor: AMBER }} />
            </div>
          ))}
        </div>

        <div className="mt-3 h-6 rounded-full" style={{ backgroundColor: AMBER }} />
      </div>
    </div>
  );
}
